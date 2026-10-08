// 打包 APK 之前把「当前安装版本」的更新日志写进 src/data/bundledChangelog.json。
// 稳定版正文与 version.json 顶层 desc 相同（CHANGELOG 段落经 cleanNotes）。
// 开发版正文与 version.json 的 dev.desc 相同（GitHub generate-notes 经 cleanNotes）。
//
// node scripts/write-bundled-changelog.mjs stable 0.4.0
// node scripts/write-bundled-changelog.mjs dev 0.4.0-dev.1 notes.md
// node scripts/write-bundled-changelog.mjs dev 0.4.0-dev.1 --github-json generate-notes.json --notes-out notes.md
// node scripts/write-bundled-changelog.mjs dev 0.4.0-dev.1 --subjects subjects.txt
// --allow-empty：生成失败时写入空说明并退出 0，避免挡住发版。
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseVersion } from './version-code.mjs'
import { changelogSectionMeta, cleanNotes } from './update-feed.mjs'

export const bundledChangelogPath = (cwd = process.cwd()) => path.join(cwd, 'src', 'data', 'bundledChangelog.json')

export function utcDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export function notesFromCommitSubjects(subjects) {
  const lines = []
  const seen = new Set()
  for (const raw of subjects) {
    const subject = String(raw ?? '').split('\n')[0].trim()
    if (!subject || seen.has(subject)) continue
    seen.add(subject)
    lines.push(`- ${subject.replace(/^[-*]\s+/, '')}`)
  }
  return lines.join('\n')
}

export function subjectsFromJqLines(text) {
  return String(text ?? '').split('\n').filter(line => line.trim()).map(line => {
    try {
      const value = JSON.parse(line)
      return typeof value == 'string' ? value : line
    } catch {
      return line
    }
  })
}

export function bodyFromGenerateNotes(input) {
  const parsed = typeof input == 'string' ? JSON.parse(input) : input
  if (parsed == null || typeof parsed.body != 'string' || !parsed.body.trim()) {
    throw new Error('generate-notes 没有正文')
  }
  return parsed.body
}

export function buildBundledChangelog({ channel, version, notes, cwd = process.cwd(), date } = {}) {
  const parsed = parseVersion(version)
  if (!parsed) throw new Error(`版本号不合法：${version}`)
  if (channel == 'stable') {
    if (parsed.dev != null) throw new Error('稳定版不能带预发布号')
    const section = changelogSectionMeta(parsed.version, cwd)
    return {
      version: parsed.version,
      channel: 'stable',
      date: date ?? section.date,
      desc: section.desc,
    }
  }
  if (channel == 'dev') {
    if (parsed.dev == null) throw new Error('开发版必须是 X.Y.Z-dev.N')
    if (notes == null) throw new Error('开发版需要 release notes')
    const desc = cleanNotes(notes)
    if (!desc) throw new Error('开发版说明是空的')
    return {
      version: parsed.version,
      channel: 'dev',
      date: date ?? utcDate(),
      desc,
    }
  }
  throw new Error(`未知通道：${channel}`)
}

export function emptyBundledChangelog(version, channel) {
  const parsed = parseVersion(version)
  return {
    version: parsed?.version ?? String(version ?? ''),
    channel: channel == 'dev' ? 'dev' : 'stable',
    date: '',
    desc: '',
  }
}

export function writeBundledChangelog(entry, cwd = process.cwd()) {
  const file = bundledChangelogPath(cwd)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(entry, null, 2) + '\n')
  return file
}

const parseArgs = argv => {
  const positional = []
  const flags = { allowEmpty: false, subjects: '', githubJson: '', notesOut: '' }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg == '--allow-empty') flags.allowEmpty = true
    else if (arg == '--subjects') flags.subjects = argv[++i] ?? ''
    else if (arg == '--github-json') flags.githubJson = argv[++i] ?? ''
    else if (arg == '--notes-out') flags.notesOut = argv[++i] ?? ''
    else positional.push(arg)
  }
  return { positional, flags }
}

const resolveEntry = (channel, version, third, flags) => {
  if (channel == 'stable') return buildBundledChangelog({ channel, version })
  if (channel != 'dev') throw new Error('用法：node scripts/write-bundled-changelog.mjs <stable|dev> <version> [notes.md]')
  if (flags.githubJson) {
    const body = bodyFromGenerateNotes(fs.readFileSync(flags.githubJson, 'utf8'))
    if (flags.notesOut) {
      fs.writeFileSync(flags.notesOut, body.endsWith('\n') ? body : `${body}\n`)
    }
    return buildBundledChangelog({ channel, version, notes: body })
  }
  if (flags.subjects) {
    const notes = notesFromCommitSubjects(subjectsFromJqLines(fs.readFileSync(flags.subjects, 'utf8')))
    return buildBundledChangelog({ channel, version, notes })
  }
  if (!third) throw new Error('开发版需要 release notes')
  return buildBundledChangelog({ channel, version, notes: fs.readFileSync(third, 'utf8') })
}

const isMain = process.argv[1] && import.meta.url == pathToFileURL(path.resolve(process.argv[1])).href
if (isMain) {
  const { positional, flags } = parseArgs(process.argv.slice(2))
  const [channel, version, third] = positional
  try {
    if (!channel || !version) throw new Error('用法：node scripts/write-bundled-changelog.mjs <stable|dev> <version> [notes.md]')
    const entry = resolveEntry(channel, version, third, flags)
    const file = writeBundledChangelog(entry)
    console.log(`已写入 ${file}（${entry.version}）`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (!flags.allowEmpty) {
      console.error(message)
      process.exit(1)
    }
    const entry = emptyBundledChangelog(version, channel)
    const file = writeBundledChangelog(entry)
    console.warn(`更新日志未写入正文，已写入空说明（${file}）：${message}`)
  }
}
