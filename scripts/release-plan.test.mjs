import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { plan } from './next-version.mjs'
import { changelogSection, cleanNotes, updateFeed } from './update-feed.mjs'

const git = (cwd, args) => execFileSync('git', args, { cwd, stdio: 'ignore' })

const changelogFor = versions => versions.map(version => [
  `## [${version}] - 2026-10-08`,
  '',
  `## v${version}`,
  '',
  '### 新增',
  '',
  `- 说明 ${version}`,
  '',
].join('\n')).join('\n')

const writePackage = (cwd, version) => {
  fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ version }) + '\n')
}

const initRepo = (version = '0.3.1') => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'lux-rel-'))
  git(cwd, ['init', '-b', 'master'])
  git(cwd, ['config', 'user.email', 'test@example.com'])
  git(cwd, ['config', 'user.name', 'test'])
  writePackage(cwd, version)
  fs.writeFileSync(path.join(cwd, 'CHANGELOG.md'), changelogFor([version]))
  fs.mkdirSync(path.join(cwd, 'publish'))
  fs.writeFileSync(path.join(cwd, 'publish', 'version.json'), JSON.stringify({
    version,
    desc: `已发布 ${version}`,
    history: [{ version: '0.3.0', desc: '旧说明' }],
  }) + '\n')
  git(cwd, ['add', '.'])
  git(cwd, ['commit', '-m', 'init'])
  git(cwd, ['tag', `v${version}`])
  git(cwd, ['tag', 'v0.2.9-beta'])
  git(cwd, ['tag', 'v0.2.18-beta'])
  return cwd
}

const commitChange = (cwd, message = 'feature') => {
  fs.writeFileSync(path.join(cwd, 'FEATURE'), message + '\n')
  git(cwd, ['add', 'FEATURE'])
  git(cwd, ['commit', '-m', message])
}

const readFeed = cwd => JSON.parse(fs.readFileSync(path.join(cwd, 'publish', 'version.json'), 'utf8'))

test('master：当前版本的 tag 已存在时跳过，不因普通 push 重发', () => {
  const cwd = initRepo()
  const result = plan('master', cwd)
  assert.equal(result.skip, 'true')
  assert.equal(result.version, '0.3.1')
  assert.equal(result.tag, 'v0.3.1')
  assert.equal(result.prerelease, 'false')
})

test('master：版本小于等于已发布稳定版时失败', () => {
  const cwd = initRepo()
  writePackage(cwd, '0.3.0')
  git(cwd, ['add', 'package.json'])
  git(cwd, ['commit', '-m', 'downgrade'])
  assert.throws(() => plan('master', cwd), /不大于已发布稳定版 v0.3.1/)
})

test('master：新稳定版缺少 CHANGELOG 段落时失败', () => {
  const cwd = initRepo()
  writePackage(cwd, '0.4.0')
  git(cwd, ['add', 'package.json'])
  git(cwd, ['commit', '-m', 'bump'])
  assert.throws(() => plan('master', cwd), /CHANGELOG.md 中找不到 0.4.0/)
})

test('master：新稳定版在 CHANGELOG 写好后可以发布', () => {
  const cwd = initRepo()
  writePackage(cwd, '0.4.0')
  fs.writeFileSync(path.join(cwd, 'CHANGELOG.md'), changelogFor(['0.4.0', '0.3.1']))
  git(cwd, ['add', '.'])
  git(cwd, ['commit', '-m', 'release'])
  const result = plan('master', cwd)
  assert.equal(result.skip, 'false')
  assert.equal(result.tag, 'v0.4.0')
  assert.equal(result.prerelease, 'false')
  assert.equal(result.prev_tag, 'v0.3.1')
})

test('dev：忽略 beta tag，第一个开发版是下一个 minor 的 dev.1', () => {
  const cwd = initRepo()
  commitChange(cwd)
  const result = plan('dev', cwd)
  assert.deepEqual(
    { skip: result.skip, version: result.version, tag: result.tag, prerelease: result.prerelease },
    { skip: 'false', version: '0.4.0-dev.1', tag: 'v0.4.0-dev.1', prerelease: 'true' },
  )
})

test('dev：已有 dev tag 时 N 递增；HEAD 已挂 dev tag 时跳过', () => {
  const cwd = initRepo()
  commitChange(cwd, 'first')
  git(cwd, ['tag', 'v0.4.0-dev.1'])
  commitChange(cwd, 'second')
  assert.equal(plan('dev', cwd).version, '0.4.0-dev.2')
  git(cwd, ['tag', 'v0.4.0-dev.2'])
  const again = plan('dev', cwd)
  assert.equal(again.skip, 'true')
  assert.equal(again.tag, 'v0.4.0-dev.2')
})

test('dev：与最新稳定版代码相同（例如刚回并）时跳过', () => {
  const cwd = initRepo()
  const result = plan('dev', cwd)
  assert.equal(result.skip, 'true')
})

test('hotfix 之后开发版仍指向下一个 minor，转正后切到再下一个 minor', () => {
  const cwd = initRepo()
  git(cwd, ['tag', 'v0.4.0'])
  git(cwd, ['tag', 'v0.4.0-dev.3', 'HEAD'])
  writePackage(cwd, '0.4.1')
  git(cwd, ['add', 'package.json'])
  git(cwd, ['commit', '-m', 'hotfix'])
  git(cwd, ['tag', 'v0.4.1'])
  commitChange(cwd, 'after hotfix')
  assert.equal(plan('dev', cwd).version, '0.5.0-dev.1')

  const promoted = initRepo('0.4.0')
  commitChange(promoted, 'next cycle')
  assert.equal(plan('dev', promoted).version, '0.5.0-dev.1')
})

test('dev-target 可以抬高目标版本，但不能把目标降回去', () => {
  const cwd = initRepo()
  commitChange(cwd)
  fs.mkdirSync(path.join(cwd, '.github'))
  fs.writeFileSync(path.join(cwd, '.github', 'dev-target'), '1.0.0\n')
  assert.equal(plan('dev', cwd).version, '1.0.0-dev.1')

  fs.writeFileSync(path.join(cwd, '.github', 'dev-target'), '0.4.0\n')
  assert.equal(plan('dev', cwd).version, '0.4.0-dev.1')

  fs.writeFileSync(path.join(cwd, '.github', 'dev-target'), '0.4.0-dev.1\n')
  assert.throws(() => plan('dev', cwd), /dev-target/)
})

test('dev.N 到达 98 后拒绝再分配', () => {
  const cwd = initRepo()
  commitChange(cwd)
  git(cwd, ['tag', 'v0.4.0-dev.98', 'HEAD~1'])
  assert.throws(() => plan('dev', cwd), /上限 98/)
})

test('未知分支直接失败', () => {
  const cwd = initRepo()
  assert.throws(() => plan('beta', cwd), /未知分支/)
})

test('CLI 把结果写入 GITHUB_OUTPUT', () => {
  const cwd = initRepo()
  const output = path.join(cwd, 'out.txt')
  const script = path.resolve(new URL('./next-version.mjs', import.meta.url).pathname)
  execFileSync(process.execPath, [script, 'master'], {
    cwd,
    env: { ...process.env, GITHUB_OUTPUT: output },
  })
  const text = fs.readFileSync(output, 'utf8')
  assert.match(text, /^skip=true$/m)
  assert.match(text, /^tag=v0\.3\.1$/m)
})

test('CHANGELOG 段落保留正文里的 ## vX.Y.Z，并在下一个版本标题处停下', () => {
  const cwd = initRepo()
  fs.writeFileSync(path.join(cwd, 'CHANGELOG.md'), [
    '## [0.4.0] - 2026-10-08',
    '',
    '## v0.4.0',
    '',
    '### 新增',
    '',
    '- 更新通道',
    '',
    '## [0.3.1](https://example.com/compare) - 2026-07-10',
    '',
    '- 旧版',
    '',
  ].join('\n'))
  const desc = changelogSection('0.4.0', cwd)
  assert.match(desc, /v0\.4\.0/)
  assert.match(desc, /更新通道/)
  assert.doesNotMatch(desc, /旧版/)
})

test('update-feed：dev 写入不改顶层，重复和更旧的 dev 跳过', () => {
  const cwd = initRepo()
  const notes = [
    "## What's Changed",
    '* feat: 更新通道 by @june in https://github.com/JuneDrinleng/lux-music-mobile/pull/12',
    '**Full Changelog**: https://github.com/JuneDrinleng/lux-music-mobile/compare/v0.3.1...v0.4.0-dev.1',
  ].join('\n')
  const first = updateFeed({ channel: 'dev', version: '0.4.0-dev.1', notes, cwd })
  assert.equal(first.changed, true)
  const feed = readFeed(cwd)
  assert.equal(feed.version, '0.3.1')
  assert.equal(feed.desc, '已发布 0.3.1')
  assert.equal(feed.dev.version, '0.4.0-dev.1')
  assert.match(feed.dev.desc, /feat: 更新通道/)
  assert.doesNotMatch(feed.dev.desc, /Full Changelog|@june/)
  assert.match(feed.dev.date, /^\d{4}-\d{2}-\d{2}$/)

  const before = fs.readFileSync(path.join(cwd, 'publish', 'version.json'), 'utf8')
  assert.equal(updateFeed({ channel: 'dev', version: '0.4.0-dev.1', notes, cwd }).changed, false)
  assert.equal(updateFeed({ channel: 'dev', version: '0.3.9-dev.4', notes, cwd }).changed, false)
  assert.throws(() => updateFeed({ channel: 'dev', version: '0.4.0-dev.0', notes, cwd }), /不合法/)
  assert.equal(fs.readFileSync(path.join(cwd, 'publish', 'version.json'), 'utf8'), before)
})

test('update-feed：稳定版从 CHANGELOG 生成说明，并把旧版本压入 history', () => {
  const cwd = initRepo()
  fs.writeFileSync(path.join(cwd, 'CHANGELOG.md'), changelogFor(['0.4.0', '0.3.1']))
  const result = updateFeed({ channel: 'stable', version: '0.4.0', cwd })
  assert.equal(result.changed, true)
  const feed = readFeed(cwd)
  assert.equal(feed.version, '0.4.0')
  assert.match(feed.desc, /说明 0\.4\.0/)
  assert.equal(feed.history[0].version, '0.3.1')
  assert.equal(feed.history[0].desc, '已发布 0.3.1')
  assert.equal(updateFeed({ channel: 'stable', version: '0.4.0', cwd }).changed, false)
  assert.equal(updateFeed({ channel: 'stable', version: '0.3.1', cwd }).changed, false)
})

test('update-feed 拒绝把开发版写进稳定通道', () => {
  const cwd = initRepo()
  assert.throws(() => updateFeed({ channel: 'stable', version: '0.4.0-dev.1', cwd }), /预发布/)
})

test('cleanNotes 去掉 GitHub 自动说明里的噪音', () => {
  const cleaned = cleanNotes('**Full Changelog**: https://example.com\n* fix: 播放 by @a in https://github.com/x/y/pull/1\n')
  assert.equal(cleaned, '- fix: 播放')
})
