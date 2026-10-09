#!/usr/bin/env bash
# 缓存未命中时用 sdkmanager 安装 NDK。下载损坏时删掉半成品和临时目录，最多尝试 3 次。
set -euo pipefail

: "${NDK_VERSION:?NDK_VERSION 未设置}"
: "${NDK_DIR:?NDK_DIR 未设置}"
: "${SDK_ROOT:?SDK_ROOT 未设置}"

if [ "$NDK_DIR" != "${SDK_ROOT}/ndk/${NDK_VERSION}" ]; then
  echo "::error::NDK 目录与版本不一致: ${NDK_DIR}"
  exit 1
fi
case "$NDK_VERSION" in
  *[!0-9.]*)
    echo "::error::ndkVersion 含非法字符: ${NDK_VERSION}"
    exit 1
    ;;
esac
if [ ! -d "$SDK_ROOT" ]; then
  echo "::error::Android SDK 不存在: ${SDK_ROOT}"
  exit 1
fi

ndk_ready() {
  local props="${NDK_DIR}/source.properties"
  local revision=""
  [ -f "$props" ] || return 1
  revision="$(sed -nE 's/^Pkg\.Revision[[:space:]]*=[[:space:]]*([0-9.]+)[[:space:]]*$/\1/p' "$props")"
  [ "$revision" = "$NDK_VERSION" ] || return 1
  [ -f "${NDK_DIR}/ndk-build" ] || return 1
  [ -e "${NDK_DIR}/toolchains/llvm/prebuilt/linux-x86_64/bin/clang" ] || return 1
}

find_sdkmanager() {
  local candidate
  for candidate in \
    "${SDK_ROOT}/cmdline-tools/latest/bin/sdkmanager" \
    "${SDK_ROOT}/cmdline-tools/bin/sdkmanager"
  do
    if [ -x "$candidate" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  local found
  found="$(find "${SDK_ROOT}/cmdline-tools" -type f -path '*/bin/sdkmanager' -perm -111 2>/dev/null | head -n1 || true)"
  if [ -n "$found" ]; then
    printf '%s\n' "$found"
    return 0
  fi
  if command -v sdkmanager >/dev/null 2>&1; then
    command -v sdkmanager
    return 0
  fi
  return 1
}

# sdkmanager 把未下完的包放在 SDK 的 .temp，并把下载缓存放在 ~/.android/cache。
# 损坏的 zip 留在这两处时，下次还会解压失败。
cleanup_partial() {
  rm -rf "$NDK_DIR"
  rm -rf "${SDK_ROOT}/.temp" "${SDK_ROOT}/.downloadIntermediates"
  if [ -n "${HOME:-}" ] && [ "$HOME" != "/" ]; then
    rm -rf "${HOME}/.android/cache" "${HOME}/.android/tmp"
  fi
}

if ndk_ready; then
  echo "NDK ${NDK_VERSION} 已在 ${NDK_DIR}，跳过下载"
  exit 0
fi

sdkmanager="$(find_sdkmanager)" || {
  echo "::error::找不到 sdkmanager（已查找 ${SDK_ROOT}/cmdline-tools/latest/bin/sdkmanager）"
  exit 1
}
echo "使用 ${sdkmanager}"

if [ ! -s "${SDK_ROOT}/licenses/android-sdk-license" ]; then
  mkdir -p "${SDK_ROOT}/licenses"
  printf '%s\n' "24333f8a63b6825ea9c5514f83c2829b004d1fee" > "${SDK_ROOT}/licenses/android-sdk-license"
fi

attempts=3
for attempt in 1 2 3; do
  echo "安装 NDK ${NDK_VERSION}（第 ${attempt}/${attempts} 次）"
  cleanup_partial
  status=0
  timeout 900 "$sdkmanager" --sdk_root="$SDK_ROOT" --install "ndk;${NDK_VERSION}" || status=$?
  if ndk_ready; then
    echo "NDK ${NDK_VERSION} 已安装到 ${NDK_DIR}"
    exit 0
  fi
  echo "第 ${attempt} 次安装失败（sdkmanager 退出码 ${status}）" >&2
  if [ "$attempt" -lt "$attempts" ]; then
    sleep 15
  fi
done

cleanup_partial
echo "::error::安装 NDK ${NDK_VERSION} 失败，已尝试 ${attempts} 次。每次都删除了 ${NDK_DIR} 以及 sdkmanager 临时目录（${SDK_ROOT}/.temp、${HOME}/.android/cache）后重试。"
exit 1
