import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { changelogSection, updateFeed } from './update-feed.mjs'
import {
  bodyFromGenerateNotes,
  buildBundledChangelog,
  notesFromCommitSubjects,
  subjectsFromJqLines,
} from './write-bundled-changelog.mjs'

const script = path.resolve(new URL('./write-bundled-changelog.mjs', import.meta.url).pathname)

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

const initRepo = (version = '0.3.1') => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'lux-notes-'))
  fs.writeFileSync(path.join(cwd, 'CHANGELOG.md'), changelogFor([version, '0.3.0']))
  fs.mkdirSync(path.join(cwd, 'publish'))
  fs.writeFileSync(path.join(cwd, 'publish', 'version.json'), JSON.stringify({
    version,
    desc: `已发布 ${version}`,
    history: [],
  }) + '\n')
  return cwd
}

const loadMatchers = () => {
  let code = fs.readFileSync(new URL('../src/utils/installedChangelog.ts', import.meta.url), 'utf8')
  code = code
    .replace(/^\/\*[\s\S]*?\*\/\n/, '')
    .replace(/^import .*$/gm, '')
    .replace(/^export interface [\s\S]*?^}\n/gm, '')
    .replace(/: Promise<[^>\n]+>/g, '')
    .replace(/: InstalledChangelog \| null/g, '')
    .replace(/: ReleaseChannel/g, '')
    .replace(/: unknown/g, '')
    .replace(/: string/g, '')
    .replace(/ as Record<string, unknown>/g, '')
    .replace(/^export const /gm, 'const ')
  const isDevBuild = version => /-dev\.\d+$/.test(version)
  // 与 scripts/release-channel.test.mjs 相同：剥掉类型后执行纯函数。
  // eslint-disable-next-line no-new-func
  return new Function('isDevBuild', `${code}\nreturn { readBundledChangelog, matchVersionFeed };`)(isDevBuild)
}

test('稳定版打包日志与 version.json 顶层 desc 使用同一段 CHANGELOG', () => {
  const cwd = initRepo()
  fs.writeFileSync(path.join(cwd, 'CHANGELOG.md'), changelogFor(['0.4.0', '0.3.1']))
  updateFeed({ channel: 'stable', version: '0.4.0', cwd })
  const entry = buildBundledChangelog({ channel: 'stable', version: '0.4.0', cwd })
  const feed = JSON.parse(fs.readFileSync(path.join(cwd, 'publish', 'version.json'), 'utf8'))
  assert.equal(entry.desc, feed.desc)
  assert.equal(entry.desc, changelogSection('0.4.0', cwd))
  assert.equal(entry.channel, 'stable')
  assert.equal(entry.date, '2026-10-08')
  assert.match(entry.desc, /说明 0\.4\.0/)
})

test('开发版打包日志与 version.json dev.desc 使用同一套 cleanNotes', () => {
  const cwd = initRepo()
  const notes = [
    "## What's Changed",
    '* feat: 更新通道 by @june in https://github.com/JuneDrinleng/lux-music-mobile/pull/12',
    '**Full Changelog**: https://github.com/JuneDrinleng/lux-music-mobile/compare/v0.3.1...v0.4.0-dev.1',
  ].join('\n')
  updateFeed({ channel: 'dev', version: '0.4.0-dev.1', notes, cwd })
  const entry = buildBundledChangelog({
    channel: 'dev',
    version: '0.4.0-dev.1',
    notes,
    cwd,
    date: '2026-10-08',
  })
  const feed = JSON.parse(fs.readFileSync(path.join(cwd, 'publish', 'version.json'), 'utf8'))
  assert.equal(entry.desc, feed.dev.desc)
  assert.equal(entry.channel, 'dev')
  assert.equal(entry.date, '2026-10-08')
  assert.equal(feed.version, '0.3.1')
  assert.doesNotMatch(entry.desc, /Full Changelog|@june/)
})

test('generate-notes JSON 与提交标题都能变成开发版说明', () => {
  const body = bodyFromGenerateNotes(JSON.stringify({
    body: '## What\'s Changed\n* fix: 播放 by @a in https://github.com/x/y/pull/1\n',
  }))
  const fromGithub = buildBundledChangelog({
    channel: 'dev',
    version: '0.4.0-dev.2',
    notes: body,
    date: '2026-10-08',
  })
  assert.equal(fromGithub.desc, '- fix: 播放')

  const subjects = subjectsFromJqLines('"feat: 甲\\n\\n正文"\n"feat: 甲"\nchore: 乙\n')
  const notes = notesFromCommitSubjects(subjects)
  assert.equal(notes, '- feat: 甲\n- chore: 乙')
  const fromSubjects = buildBundledChangelog({
    channel: 'dev',
    version: '0.4.0-dev.3',
    notes,
    date: '2026-10-08',
  })
  assert.match(fromSubjects.desc, /feat: 甲/)
  assert.match(fromSubjects.desc, /chore: 乙/)
})

test('空说明或错误通道不会写成看似成功的日志', () => {
  const cwd = initRepo()
  assert.throws(() => buildBundledChangelog({ channel: 'dev', version: '0.4.0-dev.1', notes: '   ', cwd }), /空的/)
  assert.throws(() => buildBundledChangelog({ channel: 'stable', version: '0.4.0-dev.1', cwd }), /预发布/)
  assert.throws(() => buildBundledChangelog({ channel: 'dev', version: '0.4.0', notes: '- x', cwd }), /开发版必须/)
  assert.throws(() => bodyFromGenerateNotes('{"body":"  "}'), /没有正文/)
})

test('CLI 失败时 --allow-empty 写入空说明且退出 0', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'lux-empty-'))
  execFileSync(process.execPath, [script, 'stable', '9.9.9', '--allow-empty'], { cwd })
  const written = JSON.parse(fs.readFileSync(path.join(cwd, 'src', 'data', 'bundledChangelog.json'), 'utf8'))
  assert.equal(written.version, '9.9.9')
  assert.equal(written.channel, 'stable')
  assert.equal(written.desc, '')
  assert.throws(() => execFileSync(process.execPath, [script, 'stable', '9.9.9'], { cwd }))
})

test('CLI 把 generate-notes 正文同时写成 Release notes 和打包日志', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'lux-gh-'))
  const jsonFile = path.join(cwd, 'gen.json')
  const notesFile = path.join(cwd, 'notes.md')
  fs.writeFileSync(jsonFile, JSON.stringify({
    body: '## What\'s Changed\n* feat: 日志 by @june in https://github.com/JuneDrinleng/lux-music-mobile/pull/3\n',
  }))
  execFileSync(process.execPath, [
    script, 'dev', '0.4.0-dev.4', '--github-json', jsonFile, '--notes-out', notesFile,
  ], { cwd })
  const notes = fs.readFileSync(notesFile, 'utf8')
  assert.match(notes, /feat: 日志 by @june/)
  const bundled = JSON.parse(fs.readFileSync(path.join(cwd, 'src', 'data', 'bundledChangelog.json'), 'utf8'))
  assert.equal(bundled.version, '0.4.0-dev.4')
  assert.equal(bundled.channel, 'dev')
  assert.equal(bundled.desc, '- feat: 日志')
  assert.match(bundled.date, /^\d{4}-\d{2}-\d{2}$/)
})

test('当前仓库的占位日志对得上 package.json 里的稳定版', () => {
  const root = path.resolve(new URL('..', import.meta.url).pathname)
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  const bundled = JSON.parse(fs.readFileSync(path.join(root, 'src', 'data', 'bundledChangelog.json'), 'utf8'))
  assert.equal(bundled.version, pkg.version)
  assert.equal(bundled.channel, 'stable')
  assert.equal(bundled.date, '2026-10-09')
  assert.equal(bundled.desc, changelogSection(pkg.version, root))
  assert.equal(fs.readFileSync(path.join(root, 'src', 'data', 'bundledChangelog.json'), 'utf8').endsWith('\n'), true)
})

test('安装包日志对不上当前版本时，才使用 version.json 里同版本的说明', () => {
  const { readBundledChangelog, matchVersionFeed } = loadMatchers()
  const bundled = {
    version: '0.3.1',
    channel: 'stable',
    date: '2026-07-10',
    desc: '稳定版说明',
  }
  assert.equal(readBundledChangelog('0.3.1', bundled).source, 'bundled')
  assert.equal(readBundledChangelog('0.3.1', bundled).desc, '稳定版说明')
  assert.equal(readBundledChangelog('0.4.0-dev.2', bundled), null)
  assert.equal(readBundledChangelog('0.3.1', { ...bundled, desc: '  ' }), null)

  const feed = {
    version: '0.3.1',
    desc: '稳定版说明',
    history: [{ version: '0.3.0', desc: '上一稳定版' }],
    dev: { version: '0.4.0-dev.4', desc: '开发版说明', date: '2026-10-08' },
  }
  assert.equal(matchVersionFeed(feed, '0.3.1').channel, 'stable')
  assert.equal(matchVersionFeed(feed, '0.3.0').desc, '上一稳定版')
  const dev = matchVersionFeed(feed, '0.4.0-dev.4')
  assert.equal(dev.channel, 'dev')
  assert.equal(dev.date, '2026-10-08')
  assert.equal(dev.desc, '开发版说明')
  assert.equal(matchVersionFeed(feed, '0.4.0-dev.3'), null)
  assert.equal(matchVersionFeed({ version: '0.3.1', desc: '' }, '0.3.1'), null)
})
