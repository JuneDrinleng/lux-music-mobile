// node scripts/update-feed.mjs stable 0.4.0
// node scripts/update-feed.mjs dev 0.5.0-dev.2 notes.md
// 顶层 version/desc/history 永远是稳定版（旧 App 只认它）。dev 字段只给新 App 的开发通道。
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { compareVersions, parseVersion } from './version-code.mjs'

export function cleanNotes(input) {
  return String(input)
    .replace(/^\*\*Full Changelog\*\*.*$/gm, '')
    .replace(/^#{1,6}\s*What's Changed\s*$/gim, '')
    .replace(/ by @\S+ in https?:\/\/\S+/g, '')
    .replace(/\s*\(\[[0-9a-f]{7,40}\]\([^)]*\)\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/^#{1,6}\s+(.+)$/gm, '$1')
    .replace(/^\* /gm, '- ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function changelogSection(version, cwd = process.cwd()) {
  const parsed = parseVersion(version)
  if (!parsed || parsed.dev != null) throw new Error(`稳定版版本号不合法：${version}`)
  const text = fs.readFileSync(path.join(cwd, 'CHANGELOG.md'), 'utf8')
  const escaped = parsed.version.replace(/\./g, '\\.')
  const head = new RegExp(`^##\\s+\\[${escaped}\\](?![\\d.]).*$`, 'm').exec(text)
  if (!head) throw new Error(`CHANGELOG.md 中找不到 ${parsed.version}`)
  const rest = text.slice(head.index + head[0].length)
  const end = rest.search(/^##\s+\[\d+\.\d+\.\d+\]/m)
  const section = end == -1 ? rest : rest.slice(0, end)
  const desc = cleanNotes(section)
  if (!desc) throw new Error(`CHANGELOG.md 中 ${parsed.version} 的说明是空的`)
  return desc
}

const isNewer = (next, current) => {
  if (!parseVersion(current)) return true
  return compareVersions(next, current) > 0
}

export function updateFeed({ channel, version, notes, cwd = process.cwd() }) {
  const parsed = parseVersion(version)
  if (!parsed) throw new Error(`版本号不合法：${version}`)
  const file = path.join(cwd, 'publish', 'version.json')
  const info = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (!Array.isArray(info.history)) info.history = []

  if (channel == 'stable') {
    if (parsed.dev != null) throw new Error('稳定版不能带预发布号')
    if (!isNewer(parsed.version, info.version)) {
      return { changed: false, message: `稳定版已是 ${info.version}，跳过` }
    }
    info.history.unshift({ version: info.version, desc: info.desc ?? '' })
    info.version = parsed.version
    info.desc = notes != null ? cleanNotes(notes) : changelogSection(parsed.version, cwd)
    if (!info.desc) throw new Error(`稳定版 ${parsed.version} 的说明是空的`)
  } else if (channel == 'dev') {
    if (parsed.dev == null) throw new Error('开发版必须是 X.Y.Z-dev.N')
    if (!isNewer(parsed.version, info.dev?.version)) {
      return { changed: false, message: `dev 已是 ${info.dev?.version}，跳过` }
    }
    if (notes == null) throw new Error('开发版需要 release notes')
    const desc = cleanNotes(notes)
    if (!desc) throw new Error('开发版说明是空的')
    info.dev = {
      version: parsed.version,
      desc,
      date: new Intl.DateTimeFormat('en-CA', {
        timeZone: 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date()),
    }
  } else {
    throw new Error(`未知通道：${channel}`)
  }

  fs.writeFileSync(file, JSON.stringify(info) + '\n')
  return { changed: true, message: `version.json ${channel} -> ${parsed.version}` }
}

const isMain = process.argv[1] && import.meta.url == pathToFileURL(path.resolve(process.argv[1])).href
if (isMain) {
  const [channel, version, notesFile] = process.argv.slice(2)
  const notes = notesFile ? fs.readFileSync(notesFile, 'utf8') : null
  const result = updateFeed({ channel, version, notes })
  console.log(result.message)
  process.exit(0)
}
