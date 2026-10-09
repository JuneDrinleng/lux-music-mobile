/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

// Lux Proprietary

import { similar } from './common'

export const COVER_NAME_MATCH_MIN = 0.72
export const COVER_SINGER_MATCH_MIN = 0.66
/** Misses are remembered so a visible row does not search again on every scroll. */
export const LOCAL_COVER_NEGATIVE_TTL_MS = 6 * 60 * 60 * 1000

const UNKNOWN_ARTIST = /^(?:<unknown>|<unknown artist>|unknown|未知|未知歌手|null|undefined)$/i
const SINGER_SPLIT = /、|&|;|；|\/|,|，|\|/
const ARTIST_TITLE_SPLIT = /^(.*?)\s*[-–—－]\s*(.+)$/
const LEADING_TRACK = /^\s*\d{1,3}\s*[.、_-]\s*/

export interface LocalSongIdentity {
  name: string
  singer: string
}

export interface LocalCoverCacheRecord {
  url: string | null
  savedAt: number
}

export type LocalCoverCacheDecision = 'use' | 'skip' | 'lookup'

const clean = (value: string | null | undefined): string => {
  if (!value) return ''
  return value.replace(/\u3000/g, ' ').trim()
}

export const isUnknownArtist = (value: string | null | undefined): boolean => {
  const text = clean(value)
  return !text || UNKNOWN_ARTIST.test(text)
}

export const fileBaseName = (fileName: string): string => {
  const base = fileName.split(/[/\\]/).pop() ?? fileName
  const dot = base.lastIndexOf('.')
  if (dot <= 0) return clean(base)
  return clean(base.slice(0, dot))
}

/** `歌手 - 歌名`. A leading track number is not the artist. */
export const splitArtistTitle = (text: string): LocalSongIdentity | null => {
  const cleaned = clean(text).replace(LEADING_TRACK, '')
  const match = ARTIST_TITLE_SPLIT.exec(cleaned)
  if (!match) return null
  let singer = clean(match[1])
  let name = clean(match[2])
  if (/^\d{1,3}$/.test(singer)) {
    const again = ARTIST_TITLE_SPLIT.exec(name)
    if (!again) return name ? { singer: '', name } : null
    singer = clean(again[1])
    name = clean(again[2])
  }
  if (!singer || !name) return null
  return { singer, name }
}

/**
 * Tags win when both the title and the artist are present.
 * Otherwise read `歌手 - 歌名` from the title, then from the file name.
 */
export const parseLocalSongIdentity = (input: {
  title?: string | null
  artist?: string | null
  fileName?: string | null
}): LocalSongIdentity => {
  const title = clean(input.title)
  const artist = isUnknownArtist(input.artist) ? '' : clean(input.artist)
  const fromTitle = title ? splitArtistTitle(title) : null
  const fileText = input.fileName ? fileBaseName(input.fileName).replace(LEADING_TRACK, '') : ''
  const fromFile = fileText ? (splitArtistTitle(fileText) ?? { singer: '', name: fileText }) : { singer: '', name: '' }

  if (title && artist) {
    if (fromTitle && textsFuzzyMatch(fromTitle.singer, artist, COVER_SINGER_MATCH_MIN)) {
      return { name: fromTitle.name, singer: artist }
    }
    return { name: title, singer: artist }
  }
  if (title && !artist) {
    if (fromTitle?.singer && fromTitle.name) return fromTitle
    if (fromFile.singer && fromFile.name && textsFuzzyMatch(fromFile.name, title, COVER_NAME_MATCH_MIN)) {
      return { name: title, singer: fromFile.singer }
    }
    if (fromFile.singer && fromFile.name && title == fileText) return fromFile
    return { name: title, singer: '' }
  }
  if (!title && artist) return { name: fromFile.name, singer: artist }
  return fromFile.name || fromFile.singer ? fromFile : { name: '', singer: '' }
}

export const normalizeMatchText = (value: string): string => {
  return value.toLowerCase().replace(/[\s'.,，&"、()（）`~\-<>|/[\]!！]/g, '')
}

export const splitSingers = (singer: string): string[] => {
  return singer.split(SINGER_SPLIT).map(part => part.trim()).filter(Boolean)
}

export const textsFuzzyMatch = (left: string, right: string, minimum: number): boolean => {
  const a = normalizeMatchText(left)
  const b = normalizeMatchText(right)
  if (!a || !b) return false
  if (a == b) return true
  const shorter = a.length <= b.length ? a : b
  const longer = a.length <= b.length ? b : a
  if (shorter.length >= 2 && longer.includes(shorter) && shorter.length / longer.length >= 0.8) return true
  return similar(a, b) >= minimum
}

export const singersFuzzyMatch = (left: string, right: string): boolean => {
  const query = splitSingers(left)
  const candidate = splitSingers(right)
  if (!query.length || !candidate.length) return false
  return query.some(one => candidate.some(other => textsFuzzyMatch(one, other, COVER_SINGER_MATCH_MIN)))
}

/** Both the song name and at least one singer have to fuzzy-match. */
export const isLocalCoverMatch = (query: LocalSongIdentity, candidate: LocalSongIdentity): boolean => {
  if (!query.name || !query.singer) return false
  if (!candidate.name || !candidate.singer) return false
  if (!textsFuzzyMatch(query.name, candidate.name, COVER_NAME_MATCH_MIN)) return false
  return singersFuzzyMatch(query.singer, candidate.singer)
}

export const coverMatchScore = (query: LocalSongIdentity, candidate: LocalSongIdentity): number => {
  if (!isLocalCoverMatch(query, candidate)) return 0
  const nameScore = similar(normalizeMatchText(query.name), normalizeMatchText(candidate.name))
  let singerScore = 0
  for (const one of splitSingers(query.singer)) {
    for (const other of splitSingers(candidate.singer)) {
      singerScore = Math.max(singerScore, similar(normalizeMatchText(one), normalizeMatchText(other)))
    }
  }
  return nameScore + singerScore
}

export const decideLocalCoverCache = (
  record: LocalCoverCacheRecord | null | undefined,
  now: number,
): LocalCoverCacheDecision => {
  if (!record || typeof record.savedAt != 'number' || !Number.isFinite(record.savedAt)) return 'lookup'
  if (typeof record.url == 'string' && record.url.trim()) return 'use'
  if (record.url == null && now - record.savedAt < LOCAL_COVER_NEGATIVE_TTL_MS && now >= record.savedAt) return 'skip'
  return 'lookup'
}

const isCacheRecord = (value: unknown): value is LocalCoverCacheRecord => {
  if (!value || typeof value != 'object') return false
  const record = value as LocalCoverCacheRecord
  if (typeof record.savedAt != 'number' || !Number.isFinite(record.savedAt)) return false
  return record.url == null || (typeof record.url == 'string' && record.url.trim().length > 0)
}

export const parseLocalCoverCache = (raw: string | null | undefined): Record<string, LocalCoverCacheRecord> => {
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed != 'object') return {}
    const entries = (parsed as { entries?: unknown }).entries
    if (!entries || typeof entries != 'object') return {}
    const map: Record<string, LocalCoverCacheRecord> = {}
    for (const [key, value] of Object.entries(entries as Record<string, unknown>)) {
      const id = key.trim()
      if (!id || !isCacheRecord(value)) continue
      map[id] = {
        url: typeof value.url == 'string' ? value.url.trim() : null,
        savedAt: value.savedAt,
      }
    }
    return map
  } catch {
    return {}
  }
}

export const serializeLocalCoverCache = (map: Record<string, LocalCoverCacheRecord>): string => {
  return JSON.stringify({ version: 1, entries: map })
}

export const pruneLocalCoverCache = (
  map: Record<string, LocalCoverCacheRecord>,
  now: number,
): Record<string, LocalCoverCacheRecord> => {
  const next: Record<string, LocalCoverCacheRecord> = {}
  for (const [key, record] of Object.entries(map)) {
    if (decideLocalCoverCache(record, now) == 'lookup') continue
    next[key] = record
  }
  return next
}
