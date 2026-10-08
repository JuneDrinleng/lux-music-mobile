// 用法：node scripts/next-version.mjs <dev|master>
// 结果打印为 key=value；若设置了 GITHUB_OUTPUT，同时追加到该文件。
// master：版本 = package.json（必须是 X.Y.Z）。对应 tag 已存在则 skip。
//         版本不大于最新稳定版 tag，或 CHANGELOG 没有该版本段落，则失败（不发版）。
// dev：  版本 = 最新稳定版的下一个 minor + -dev.N（可用 .github/dev-target 抬高目标）。
//         HEAD 已有 dev tag，或代码树与最新稳定版 tag 相同，则 skip。
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { assertEncodable, compareVersions, parseVersion } from './version-code.mjs'
import { changelogSection } from './update-feed.mjs'

const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()

const tagName = parsed => `v${parsed.version}`

const listVersions = cwd => {
  const raw = git(cwd, ['tag', '-l', 'v*'])
  return raw.split('\n').filter(Boolean).map(parseVersion).filter(Boolean).sort(compareVersions)
}

export function plan(branch, cwd = process.cwd()) {
  const all = listVersions(cwd)
  const stables = all.filter(item => item.dev == null)
  const lastStable = stables.at(-1) ?? parseVersion('0.0.0')
  const out = {
    skip: 'false',
    version: '',
    tag: '',
    prerelease: 'false',
    prev_tag: all.at(-1) ? tagName(all.at(-1)) : '',
  }

  if (branch == 'master') {
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'))
    const parsed = parseVersion(pkg.version)
    if (!parsed || parsed.dev != null) throw new Error(`master 的版本必须是 X.Y.Z：${pkg.version}`)
    assertEncodable(parsed)
    out.version = parsed.version
    out.tag = tagName(parsed)
    out.prerelease = 'false'
    out.prev_tag = stables.length > 0 ? tagName(lastStable) : ''
    const tags = new Set(git(cwd, ['tag', '-l', 'v*']).split('\n').filter(Boolean))
    if (tags.has(out.tag)) {
      out.skip = 'true'
    } else if (compareVersions(parsed, lastStable) <= 0) {
      throw new Error(`${parsed.version} 不大于已发布稳定版 ${tagName(lastStable)}`)
    } else {
      changelogSection(parsed.version, cwd)
    }
  } else if (branch == 'dev') {
    const headTags = git(cwd, ['tag', '--points-at', 'HEAD']).split('\n').filter(Boolean)
    let sameAsStable = false
    if (stables.length > 0) {
      try {
        git(cwd, ['diff', '--quiet', tagName(lastStable), 'HEAD'])
        sameAsStable = true
      } catch {
        sameAsStable = false
      }
    }
    if (sameAsStable || headTags.some(item => /-dev\.\d+$/.test(item))) {
      out.skip = 'true'
      const pointed = headTags.map(parseVersion).filter(item => item?.dev != null).at(-1)
      if (pointed) {
        out.version = pointed.version
        out.tag = tagName(pointed)
        out.prerelease = 'true'
      }
    } else {
      let target = parseVersion(`${lastStable.major}.${lastStable.minor + 1}.0`)
      if (lastStable.minor + 1 > 99) {
        target = parseVersion(`${lastStable.major + 1}.0.0`)
      }
      const targetFile = path.join(cwd, '.github', 'dev-target')
      if (fs.existsSync(targetFile)) {
        const line = fs.readFileSync(targetFile, 'utf8').trim().split(/\s+/)[0] ?? ''
        if (!line) throw new Error('.github/dev-target 为空')
        const specified = parseVersion(line)
        if (!specified || specified.dev != null) throw new Error(`.github/dev-target 必须是 X.Y.Z：${line}`)
        if (compareVersions(specified, target) > 0) target = specified
      }
      assertEncodable(target)
      const base = target.version
      const n = Math.max(0, ...all.filter(item => item.dev != null && `${item.major}.${item.minor}.${item.patch}` == base).map(item => item.dev)) + 1
      if (n > 98) throw new Error(`${base}-dev.N 已到上限 98，请先转正`)
      const version = `${base}-dev.${n}`
      assertEncodable(version)
      out.version = version
      out.tag = `v${version}`
      out.prerelease = 'true'
    }
  } else {
    throw new Error(`未知分支：${branch}（只接受 dev 或 master）`)
  }

  return out
}

export function formatPlan(out) {
  return Object.entries(out).map(([key, value]) => `${key}=${value}`).join('\n')
}

const isMain = process.argv[1] && import.meta.url == pathToFileURL(path.resolve(process.argv[1])).href
if (isMain) {
  const branch = process.argv[2]
  if (!branch) {
    console.error('用法：node scripts/next-version.mjs <dev|master>')
    process.exit(1)
  }
  const lines = formatPlan(plan(branch))
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, lines + '\n')
  console.log(lines)
}
