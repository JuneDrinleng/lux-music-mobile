/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

// Lux Proprietary

export const PLAYLIST_COVER_MAP_VERSION = 1

export interface PlaylistCoverEntry {
  source: string
  id: string
  url: string
  thumbUrl: string
  updatedAt: number
}

export type PlaylistCoverMapData = Record<string, PlaylistCoverEntry>

export interface PlaylistCoverSongRef {
  picUrl?: string | null
  albumId?: string | number | null
}

const HTTP_URL = /^https?:\/\/[^\s]+$/i
const EMPTY_TX_ALBUM = /\/T00[12]R\d+x\d+M000(?:undefined|null)?\.jpg(?:$|\?)/i

export const playlistCoverKey = (source: string, id: string) => `${source}_${id}`

export const isPersistableCoverUrl = (url: unknown): url is string => {
  if (typeof url != 'string') return false
  const trimmed = url.trim()
  return HTTP_URL.test(trimmed) && trimmed.length <= 2048
}

/** Reject empty, non-http, and QQ covers synthesized without an album id. */
export const isUsableSongCoverUrl = (url: unknown, source?: string | null): url is string => {
  if (!isPersistableCoverUrl(url)) return false
  const trimmed = url.trim()
  if ((source == 'tx' || /y\.gtimg\.cn|y\.qq\.com/i.test(trimmed)) && EMPTY_TX_ALBUM.test(trimmed)) return false
  return true
}

export const syntheticCoverUrl = (source: string, albumId?: string | number | null): string | null => {
  if (source != 'tx') return null
  if (albumId == null) return null
  const id = String(albumId).trim()
  if (!id || id == '空' || id == 'undefined' || id == 'null') return null
  return `https://y.gtimg.cn/music/photo_new/T002R500x500M000${id}.jpg`
}

const withQueryParam = (url: string, key: string, value: string) => {
  const hashIndex = url.indexOf('#')
  const hash = hashIndex >= 0 ? url.slice(hashIndex) : ''
  const base = hashIndex >= 0 ? url.slice(0, hashIndex) : url
  const pattern = new RegExp(`([?&])${key}=[^&]*`)
  if (pattern.test(base)) return base.replace(pattern, `$1${key}=${value}`) + hash
  const joiner = base.includes('?') ? '&' : '?'
  return `${base}${joiner}${key}=${value}${hash}`
}

/**
 * List rows are about 52dp. Ask the source for a small file when the URL exposes a size.
 * Playback keeps using the original URL, so the play-detail image stays full size.
 */
export const toPlaylistThumbUrl = (url: string, source?: string | null): string => {
  if (!isPersistableCoverUrl(url)) return url
  let next = url.trim()
  const hostIsTx = source == 'tx' || /y\.gtimg\.cn|y\.qq\.com/i.test(next)
  const hostIsWy = source == 'wy' || /126\.net|music\.163\.com/i.test(next)
  const hostIsKg = source == 'kg' || /kugou\.com|kgimg\.com/i.test(next)
  const hostIsKw = source == 'kw' || /kuwo\.cn/i.test(next)

  if (hostIsTx) {
    next = next.replace(/R(\d+)x(\d+)/, (match, width: string, height: string) => {
      if (Number(width) <= 300 && Number(height) <= 300) return match
      return 'R300x300'
    })
  }
  if (hostIsWy) {
    const current = /[?&]param=(\d+)y(\d+)/i.exec(next)
    if (!current || Number(current[1]) > 300 || Number(current[2]) > 300) {
      next = withQueryParam(next, 'param', '300y300')
    }
  }
  if (hostIsKg) {
    if (next.includes('{size}')) next = next.replace(/\{size\}/g, '240')
    next = next.replace(/\/(stdmusic|softhead|kugouicon|ncover|standard)\/(\d+)\//i, (match, folder: string, size: string) => {
      if (Number(size) <= 240) return match
      return `/${folder}/240/`
    })
  }
  if (hostIsKw) {
    next = next
      .replace(/([?&]size=)(\d+)/i, (match, prefix: string, size: string) => Number(size) <= 240 ? match : `${prefix}240`)
      .replace(/([?&]pictype=)(\d+)/i, (match, prefix: string, size: string) => Number(size) <= 240 ? match : `${prefix}240`)
      .replace(/\/albumcover\/(\d+)\//i, (match, size: string) => Number(size) <= 240 ? match : '/albumcover/240/')
  }
  return next
}

/**
 * Same URL on songs from different albums is the playlist-cover fallback written by
 * applyMusicCoverFallback, not that song's artwork. Same album id is a real shared cover.
 */
export const collectFallbackPicUrls = (songs: readonly PlaylistCoverSongRef[]): Set<string> => {
  const uses = new Map<string, { albums: Set<string>, count: number }>()
  for (const song of songs) {
    if (!isPersistableCoverUrl(song.picUrl)) continue
    const url = song.picUrl.trim()
    const album = song.albumId == null ? '' : String(song.albumId).trim()
    const current = uses.get(url) ?? { albums: new Set<string>(), count: 0 }
    current.count += 1
    current.albums.add(album)
    uses.set(url, current)
  }
  const fallback = new Set<string>()
  for (const [url, use] of uses) {
    if (use.albums.size >= 2) fallback.add(url)
    else if (use.count >= 2 && use.albums.size == 1 && use.albums.has('')) fallback.add(url)
  }
  return fallback
}

export const planSongCover = (input: {
  source: string
  id: string
  picUrl?: string | null
  albumId?: string | number | null
  mappedUrl?: string | null
  trustPicUrl: boolean
}): { canonicalUrl: string | null, thumbUrl: string | null } => {
  const mapped = input.mappedUrl && isUsableSongCoverUrl(input.mappedUrl, input.source) ? input.mappedUrl.trim() : null
  const own = input.trustPicUrl && input.picUrl && isUsableSongCoverUrl(input.picUrl, input.source) ? input.picUrl.trim() : null
  const canonical = mapped ?? own ?? syntheticCoverUrl(input.source, input.albumId)
  if (!canonical) return { canonicalUrl: null, thumbUrl: null }
  return { canonicalUrl: canonical, thumbUrl: toPlaylistThumbUrl(canonical, input.source) }
}

export const rememberPlaylistCover = (
  map: PlaylistCoverMapData,
  input: { source: string, id: string, url: string, now: number, rejectUrls?: ReadonlySet<string> },
): PlaylistCoverMapData => {
  if (!input.source || !input.id) return map
  if (!isUsableSongCoverUrl(input.url, input.source)) return map
  const url = input.url.trim()
  if (input.rejectUrls?.has(url)) return map
  const key = playlistCoverKey(input.source, input.id)
  const thumbUrl = toPlaylistThumbUrl(url, input.source)
  const prev = map[key]
  if (prev && prev.url == url && prev.thumbUrl == thumbUrl && prev.source == input.source && prev.id == input.id) return map
  return {
    ...map,
    [key]: {
      source: input.source,
      id: input.id,
      url,
      thumbUrl,
      updatedAt: input.now,
    },
  }
}

export const prunePlaylistCoverMap = (
  map: PlaylistCoverMapData,
  liveKeys: ReadonlySet<string>,
): { map: PlaylistCoverMapData, removed: PlaylistCoverEntry[] } => {
  const next: PlaylistCoverMapData = {}
  const removed: PlaylistCoverEntry[] = []
  for (const [key, entry] of Object.entries(map)) {
    if (liveKeys.has(key)) next[key] = entry
    else removed.push(entry)
  }
  return { map: next, removed }
}

export const serializePlaylistCoverMap = (map: PlaylistCoverMapData) => {
  return JSON.stringify({ v: PLAYLIST_COVER_MAP_VERSION, entries: map })
}

const isCoverEntry = (value: unknown): value is PlaylistCoverEntry => {
  if (!value || typeof value != 'object') return false
  const entry = value as Partial<PlaylistCoverEntry>
  return typeof entry.source == 'string' &&
    typeof entry.id == 'string' &&
    isUsableSongCoverUrl(entry.url, entry.source) &&
    isPersistableCoverUrl(entry.thumbUrl) &&
    typeof entry.updatedAt == 'number'
}

export const parsePlaylistCoverMap = (raw: string | null | undefined): PlaylistCoverMapData => {
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed != 'object') return {}
    const record = parsed as { entries?: unknown }
    const entries = record.entries
    if (!entries || typeof entries != 'object') return {}
    const map: PlaylistCoverMapData = {}
    for (const [key, value] of Object.entries(entries as Record<string, unknown>)) {
      if (!isCoverEntry(value)) continue
      if (playlistCoverKey(value.source, value.id) != key) continue
      map[key] = {
        source: value.source,
        id: value.id,
        url: value.url.trim(),
        thumbUrl: value.thumbUrl.trim(),
        updatedAt: value.updatedAt,
      }
    }
    return map
  } catch {
    return {}
  }
}

export const resolvePlaylistRowCover = (input: {
  source: string
  picUrl?: string | null
  togglePicUrl?: string | null
  fallbackUrl?: string | null
  mapped?: { url: string, thumbUrl: string } | null
  isCached: (url: string) => boolean
}): string | null => {
  const candidates: string[] = []
  const push = (url?: string | null) => {
    if (!isPersistableCoverUrl(url)) return
    const trimmed = url.trim()
    if (!candidates.includes(trimmed)) candidates.push(trimmed)
  }
  if (input.mapped) {
    push(input.mapped.thumbUrl)
    push(input.mapped.url)
  }
  const own = (isUsableSongCoverUrl(input.picUrl, input.source) ? input.picUrl.trim() : null) ??
    (isUsableSongCoverUrl(input.togglePicUrl, input.source) ? input.togglePicUrl.trim() : null)
  if (own) {
    push(toPlaylistThumbUrl(own, input.source))
    push(own)
  }
  for (const url of candidates) {
    if (input.isCached(url)) return url
  }
  if (candidates.length) return candidates[0]
  if (isPersistableCoverUrl(input.fallbackUrl)) return input.fallbackUrl.trim()
  return null
}

export type BackgroundCoverLaneDecision = 'start' | 'defer-foreground' | 'defer-metered' | 'idle'

/**
 * Whether the background prefetch lane may download.
 * Visible and open-playlist work always go first. A metered network never starts this lane.
 */
export const decideBackgroundCoverLane = (input: {
  unmetered: boolean
  visibleRunning: number
  playlistRunning: number
  backgroundRunning: number
  backgroundLimit: number
  visibleReady: boolean
  playlistReady: boolean
  backgroundReady: boolean
}): BackgroundCoverLaneDecision => {
  if (input.visibleRunning > 0 || input.visibleReady) return 'defer-foreground'
  if (input.playlistRunning > 0 || input.playlistReady) return 'defer-foreground'
  if (!input.backgroundReady || input.backgroundRunning >= input.backgroundLimit) return 'idle'
  if (!input.unmetered) return 'defer-metered'
  return 'start'
}

/** True only on the edge from a metered or offline network to an unmetered one. */
export const becameUnmetered = (previous: boolean, next: boolean) => !previous && next

/** Keep a cover that is already on screen until the replacement file is cached. */
export const preferStableCover = (
  current: string | null,
  next: string | null,
  isReady: (url: string) => boolean,
): string | null => {
  if (!next) return current
  if (current == next) return current
  if (current && isReady(current) && !isReady(next)) return current
  return next
}
