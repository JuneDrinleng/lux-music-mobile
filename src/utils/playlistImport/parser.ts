/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
export interface ImportTrack {
  original: string
  title: string
  artist: string
  album?: string
  duration?: number
  /** Unlabelled text can be artist - title as well as title - artist. */
  reversible?: boolean
}
export const durationSeconds = (value: string | number | null | undefined): number | undefined => {
  if (value == null || String(value).trim() === '') return undefined
  const text = String(value).trim()
  if (!/^\d+(?::[0-5]\d){0,2}(?:\.\d+)?$/.test(text)) return undefined
  const seconds = text.split(':').reduce((sum, part) => sum * 60 + Number(part), 0)
  return seconds > 0 ? seconds : undefined
}

export const parseText = (text: string): ImportTrack[] => text.replace(/^\uFEFF/, '').split(/\r?\n/).map((original): ImportTrack | null => {
  let line = original.trim().replace(/^\d+[.)、]\s*/, '')
  if (!line) return null
  let duration: number | undefined
  line = line.replace(/(?:\s+|\s*[-|]\s*)(\d{1,2}:[0-5]\d(?::[0-5]\d)?)\s*$/, (_, time: string) => {
    duration = durationSeconds(time)
    return ''
  }).trim()
  const parts = line.split(/\s+[-–—/]\s+|\t+|\s*\|\s*/).map(part => part.trim())
  if (parts.length > 1) return { original: original.trim(), title: parts[0], artist: parts[1], album: parts[2] || undefined, duration, reversible: true }
  // Parentheses carrying version/feat metadata belong to the title.
  const bracket = /^(.*?)\s*[（(]([^()（）]+)[)）]$/.exec(line)
  if (bracket && !/live|remix|ver\b|version|版|伴奏|feat\b|ft\./i.test(bracket[2])) {
    return { original: original.trim(), title: bracket[1].trim(), artist: bracket[2].trim(), duration }
  }
  const spaced = /^(\S+)\s+(.+)$/.exec(line)
  if (spaced && !/live|remix|version|版|feat\b|ft\./i.test(spaced[2])) {
    return { original: original.trim(), title: spaced[1], artist: spaced[2], duration, reversible: true }
  }
  return { original: original.trim(), title: line, artist: '', duration }
}).filter((track): track is ImportTrack => track != null && !!track.title)

/** RFC4180 state machine: keeps commas, CRLF/newlines and escaped quotes inside fields. */
export const csvRows = (text: string): string[][] => {
  const rows: string[][] = []
  let row: string[] = []; let field = ''; let quoted = false; let closed = false
  const push = () => { row.push(field); field = ''; closed = false }
  text = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else { quoted = false; closed = true }
      } else field += char
    } else if (char === '"' && !field && !closed) quoted = true
    else if (char === ',') push()
    else if (char === '\r' || char === '\n') {
      push(); if (row.some(cell => cell.trim())) rows.push(row)
      row = []; if (char === '\r' && text[i + 1] === '\n') i++
    } else {
      if (closed && char.trim()) throw new Error('CSV_INVALID_QUOTES')
      if (char === '"') throw new Error('CSV_INVALID_QUOTES')
      if (!closed) field += char
    }
  }
  if (quoted) throw new Error('CSV_UNCLOSED_QUOTE')
  push(); if (row.some(cell => cell.trim())) rows.push(row)
  return rows
}
const headers = {
  title: ['歌名', '歌曲', '歌曲名', '标题', '標題', 'title', 'name', 'track', 'track name', 'song', 'song name'],
  artist: ['歌手', '艺人', '藝術家', '演唱者', 'artist', 'artists', 'singer', 'artist name'],
  album: ['专辑', '專輯', 'album', 'album name'],
  duration: ['时长', '時長', 'duration', 'time', 'length'],
}
export const parseCSV = (text: string): ImportTrack[] => {
  const rows = csvRows(text)
  if (!rows.length) return []
  const first = rows[0].map(cell => cell.trim().toLowerCase())
  const column = (key: keyof typeof headers) => first.findIndex(cell => headers[key].includes(cell))
  const labelled = Object.keys(headers).some(key => column(key as keyof typeof headers) >= 0)
  if (labelled && column('title') < 0) throw new Error('CSV_MISSING_TITLE')
  const indices = labelled ? [column('title'), column('artist'), column('album'), column('duration')] : [0, 1, 2, 3]
  return rows.slice(labelled ? 1 : 0).map(row => {
    const [title, artist, album, duration] = indices.map(index => row[index]?.trim() ?? '')
    return { original: row.join(' · '), title, artist, album: album || undefined, duration: durationSeconds(duration) }
  }).filter(track => !!track.title)
}

/** Validate UTF-8 before falling back to GBK. Decoding is supplied by the existing iconv adapter. */
export const detectCSVEncoding = (bytes: Uint8Array): 'utf8' | 'gbk' => {
  for (let i = 0; i < bytes.length; i++) {
    const a = bytes[i]
    if (a < 128) continue
    const count = a >= 0xc2 && a <= 0xdf ? 1 : a >= 0xe0 && a <= 0xef ? 2 : a >= 0xf0 && a <= 0xf4 ? 3 : -1
    if (count < 0 || i + count >= bytes.length) return 'gbk'
    const b = bytes[i + 1]
    if ((a === 0xe0 && b < 0xa0) || (a === 0xed && b >= 0xa0) || (a === 0xf0 && b < 0x90) || (a === 0xf4 && b >= 0x90)) return 'gbk'
    for (let j = 0; j < count; j++) if ((bytes[++i] & 0xc0) !== 0x80) return 'gbk'
  }
  return 'utf8'
}

export type ImportSource = 'tx' | 'wy' | 'kg' | 'kw' | 'mg'
/** Select the platform only; pass the intact URL to songList.getListDetail, which already parses IDs/short links. */
export const parsePlatformLink = (text: string): { source: ImportSource, url: string } | null => {
  const url = text.match(/https?:\/\/[^\s<>「」]+/i)?.[0]
  if (!url) return null
  const host = /^https?:\/\/([^/:?#]+)/i.exec(url)?.[1].toLowerCase() ?? ''
  for (const [domain, source] of [['qq.com', 'tx'], ['163.com', 'wy'], ['kugou.com', 'kg'], ['kuwo.cn', 'kw'], ['migu.cn', 'mg']] as const) {
    if (host === domain || host.endsWith(`.${domain}`)) return { source, url }
  }
  return null
}
