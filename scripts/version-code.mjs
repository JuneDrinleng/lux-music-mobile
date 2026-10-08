// versionCode 编码，与 android/version-code.gradle 保持一致。
// base = ((MAJOR*100 + MINOR)*100 + PATCH)*100 + s
//   s = N（X.Y.Z-dev.N，1–98），稳定版 s = 99
// APK versionCode = base*10 + abi（universal 0，armeabi-v7a 1，x86 2，arm64-v8a 3，x86_64 4）

const VERSION_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-dev\.([1-9]\d*))?$/

export const ABI_OFFSET = {
  universal: 0,
  'armeabi-v7a': 1,
  x86: 2,
  'arm64-v8a': 3,
  x86_64: 4,
}

export function parseVersion(input) {
  const raw = String(input ?? '').trim().replace(/^v/, '')
  const m = VERSION_RE.exec(raw)
  if (!m) return null
  const major = Number(m[1])
  const minor = Number(m[2])
  const patch = Number(m[3])
  const dev = m[4] ? Number(m[4]) : null
  const version = dev == null ? `${major}.${minor}.${patch}` : `${major}.${minor}.${patch}-dev.${dev}`
  return { major, minor, patch, dev, version }
}

export function compareVersions(a, b) {
  const pa = typeof a == 'string' || a == null ? parseVersion(a) : a
  const pb = typeof b == 'string' || b == null ? parseVersion(b) : b
  if (!pa || !pb) throw new Error(`无法比较版本号: ${a} vs ${b}`)
  return pa.major - pb.major || pa.minor - pb.minor || pa.patch - pb.patch || ((pa.dev ?? 1e9) - (pb.dev ?? 1e9))
}

export function assertEncodable(input) {
  if (typeof input == 'string' && input.trim().startsWith('v')) {
    throw new Error(`版本号不合法（需 X.Y.Z 或 X.Y.Z-dev.N）: ${input}`)
  }
  const parsed = typeof input == 'string' || input == null ? parseVersion(input) : input
  const label = typeof input == 'string' ? input : parsed?.version
  if (!parsed) throw new Error(`版本号不合法（需 X.Y.Z 或 X.Y.Z-dev.N）: ${label}`)
  const s = parsed.dev ?? 99
  if (parsed.major > 209 || parsed.minor > 99 || parsed.patch > 99 || s < 1 || s > 99 || (parsed.dev != null && parsed.dev > 98)) {
    throw new Error(`版本号超出 versionCode 编码范围: ${label}`)
  }
  return parsed
}

export function computeBaseVersionCode(input) {
  const parsed = assertEncodable(input)
  const s = parsed.dev ?? 99
  return ((parsed.major * 100 + parsed.minor) * 100 + parsed.patch) * 100 + s
}

export function apkVersionCode(input, abi = 'universal') {
  if (!Object.prototype.hasOwnProperty.call(ABI_OFFSET, abi)) throw new Error(`未知 ABI: ${abi}`)
  return computeBaseVersionCode(input) * 10 + ABI_OFFSET[abi]
}
