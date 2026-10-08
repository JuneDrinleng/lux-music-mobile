/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

// 把更新日志原文整理成分点结构。只做字符串处理，解析失败时退回原文。

const GROUP_ORDER = ['feat', 'fix', 'improve', 'other']
const COMMIT_RE = /^(feat|fix|perf|refactor|chore|docs|style|build|ci|test|revert)(\([^)\n]+\))?(!)?:\s+/i
const DROPPED_HEADING_RE = /^(what'?s changed|new contributors|full changelog)$/i
const VERSION_RE = /^v?\d+\.\d+\.\d+(?:-dev\.\d+)?$/i
const LIST_RE = /^\s*[-*]\s+\S/
const HEADING_RE = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/
const SECTION_END_RE = /[。！？.!?：:;；]$/
const INLINE_RE = /\*\*([^*]+)\*\*|__([^_]+)__|`([^`]+)`/g

const parseInlines = (text) => {
  const inlines = []
  const re = new RegExp(INLINE_RE.source, 'g')
  let last = 0
  let match = re.exec(text)
  while (match) {
    if (match.index > last) inlines.push({ kind: 'text', text: text.slice(last, match.index) })
    if (match[3] != null) inlines.push({ kind: 'code', text: match[3] })
    else inlines.push({ kind: 'strong', text: match[1] != null ? match[1] : match[2] })
    last = re.lastIndex
    match = re.exec(text)
  }
  if (last < text.length) inlines.push({ kind: 'text', text: text.slice(last) })
  if (!inlines.length) inlines.push({ kind: 'text', text: '' })
  return inlines
}

const cleanNoise = (text) => text
  .replace(/\s+by\s+@[\w-]+\s+in\s+https?:\/\/\S+/gi, '')
  .replace(/\s*\(#\d+\)/g, '')
  .replace(/[ \t]{2,}/g, ' ')
  .trim()

const stripCommit = (text) => {
  const match = COMMIT_RE.exec(text)
  if (!match) return { text, type: null }
  return { text: text.slice(match[0].length).trim(), type: match[1].toLowerCase() }
}

const groupIdOf = (type) => {
  if (type == 'feat') return 'feat'
  if (type == 'fix') return 'fix'
  if (type == 'perf' || type == 'refactor' || type == 'style') return 'improve'
  return 'other'
}

const headingPlain = (text) => text
  .replace(/\*\*([^*]+)\*\*/g, '$1')
  .replace(/__([^_]+)__/g, '$1')
  .replace(/`([^`]+)`/g, '$1')
  .trim()

const isFullChangelog = (text) => /full changelog/i.test(text)
const isContribution = (text) => /made their first contribution/i.test(text)

const nextContent = (lines, start) => {
  for (let i = start; i < lines.length; i++) {
    if (lines[i].trim()) return lines[i].trim()
  }
  return ''
}

const isSectionTitle = (text) => {
  if (!text || text.length > 40) return false
  if (SECTION_END_RE.test(text)) return false
  if (LIST_RE.test(text)) return false
  if (VERSION_RE.test(text)) return false
  return true
}

const groupItems = (blocks) => {
  const items = blocks.filter(block => block.kind == 'item')
  const hasHeading = blocks.some(block => block.kind == 'heading')
  const conventional = items.some(block => block.commitType)
  if (hasHeading || items.length < 2 || !conventional) {
    return blocks.map(block => {
      if (block.kind != 'item') return block
      return { kind: 'item', inlines: block.inlines }
    })
  }
  const groups = { feat: [], fix: [], improve: [], other: [] }
  items.forEach(item => {
    groups[groupIdOf(item.commitType)].push(item.inlines)
  })
  const result = []
  let placed = false
  blocks.forEach(block => {
    if (block.kind == 'item') {
      if (placed) return
      GROUP_ORDER.forEach(id => {
        if (groups[id].length) result.push({ kind: 'group', id, items: groups[id] })
      })
      placed = true
      return
    }
    result.push(block)
  })
  return result
}

export const parseChangelog = (input) => {
  const raw = typeof input == 'string' ? input : ''
  try {
    if (typeof input != 'string') throw new TypeError('changelog')
    const lines = input.replace(/\r\n/g, '\n').split('\n')
    const blocks = []
    let seenContent = false

    lines.forEach((line, index) => {
      const trimmed = line.trim()
      if (!trimmed) return
      if (isFullChangelog(trimmed)) return

      const hashed = HEADING_RE.exec(trimmed)
      if (hashed) {
        const plain = headingPlain(hashed[1])
        if (!plain || DROPPED_HEADING_RE.test(plain) || isFullChangelog(plain)) return
        if (!seenContent && VERSION_RE.test(plain)) return
        seenContent = true
        blocks.push({ kind: 'heading', text: plain })
        return
      }

      if (!seenContent && VERSION_RE.test(trimmed)) return

      if (LIST_RE.test(trimmed)) {
        let text = cleanNoise(trimmed.replace(/^\s*[-*]\s+/, ''))
        if (!text || isFullChangelog(text) || isContribution(text)) return
        const commit = stripCommit(text)
        text = commit.text
        if (!text) return
        seenContent = true
        blocks.push({ kind: 'item', inlines: parseInlines(text), commitType: commit.type })
        return
      }

      const upcoming = nextContent(lines, index + 1)
      if (isSectionTitle(trimmed) && LIST_RE.test(upcoming)) {
        const plain = headingPlain(trimmed)
        if (!plain || DROPPED_HEADING_RE.test(plain)) return
        seenContent = true
        blocks.push({ kind: 'heading', text: plain })
        return
      }

      const text = cleanNoise(trimmed)
      if (!text || isContribution(text)) return
      seenContent = true
      blocks.push({ kind: 'paragraph', inlines: parseInlines(text) })
    })

    const grouped = groupItems(blocks)
    if (!grouped.length && raw.trim()) return { blocks: [], fallback: true, raw }
    return { blocks: grouped, fallback: false, raw }
  } catch {
    return { blocks: [], fallback: true, raw }
  }
}
