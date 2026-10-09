/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

// Lux Proprietary

export type LocalSongOrigin = 'device' | 'cache'

export interface DeviceSongInput {
  id: string
  source: string
  size: number | null
}

export interface CacheSongInput {
  cacheKey: string
  cachedBytes: number
  fullyCached: boolean
  source: string | null
  id: string | null
}

export interface MergedLocalSong {
  rowKey: string
  origin: LocalSongOrigin
  source: string
  id: string
  size: number | null
  fullyCached: boolean | null
  cacheKey: string | null
  cacheKeys: readonly string[]
  quality: string | null
  playable: boolean
}

export const AUDIO_CACHE_SOURCES = ['kw', 'kg', 'tx', 'wy', 'mg', 'local'] as const

/** Longer names first so `flac24bit` is not read as `flac`. */
export const AUDIO_CACHE_QUALITIES = ['flac24bit', '128k', '320k', '192k', 'flac', 'ape', 'wav', 'local'] as const

const AUDIO_CACHE_QUALITY_RANK: Record<string, number> = {
  flac24bit: 70,
  wav: 60,
  ape: 50,
  flac: 40,
  '320k': 30,
  '192k': 20,
  '128k': 10,
  local: 0,
}

const SOURCE_PATTERN = new RegExp(`^(${AUDIO_CACHE_SOURCES.join('|')})_(.+)$`)
const QUALITY_PATTERN = new RegExp(`_(${AUDIO_CACHE_QUALITIES.join('|')})$`)

export interface ParsedAudioCacheKey {
  cacheKey: string
  source: string
  id: string
  songmid: string
  quality: string
  hash: string | null
}

/**
 * Cache keys are `${source}_${musicId}_${quality}`.
 * Online ids already include the source (`wy_3339519499`), except kg (`audioId_hash`).
 */
export const parseAudioCacheKey = (cacheKey: string): ParsedAudioCacheKey | null => {
  if (!cacheKey) return null
  const sourceMatch = SOURCE_PATTERN.exec(cacheKey)
  if (!sourceMatch) return null
  const source = sourceMatch[1]
  const rest = sourceMatch[2]
  const qualityMatch = QUALITY_PATTERN.exec(rest)
  if (!qualityMatch) return null
  const quality = qualityMatch[1]
  const id = rest.slice(0, rest.length - qualityMatch[0].length)
  if (!id) return null
  let songmid = id
  let hash: string | null = null
  if (source != 'local' && source != 'kg' && id.startsWith(`${source}_`)) {
    songmid = id.slice(source.length + 1)
  } else if (source == 'kg') {
    const split = id.indexOf('_')
    if (split > 0) {
      songmid = id.slice(0, split)
      hash = id.slice(split + 1) || null
    }
  }
  if (!songmid) return null
  return { cacheKey, source, id, songmid, quality, hash }
}

export const fallbackCacheSongName = (cacheKey: string): string => {
  const parsed = parseAudioCacheKey(cacheKey)
  if (!parsed) return ''
  if (parsed.source == 'local') {
    const base = parsed.id.split('/').pop() ?? ''
    const dot = base.lastIndexOf('.')
    const name = (dot > 0 ? base.slice(0, dot) : base).trim()
    return name && name != cacheKey ? name : ''
  }
  const songmid = parsed.songmid.trim()
  if (!songmid || songmid == cacheKey) return ''
  return songmid
}

const qualityRank = (quality: string | null | undefined) => {
  if (!quality) return -1
  return AUDIO_CACHE_QUALITY_RANK[quality] ?? -1
}

export interface CompleteCacheGroup {
  cacheKey: string
  cacheKeys: string[]
  cachedBytes: number
  fullyCached: true
  source: string | null
  id: string | null
  quality: string | null
}

const cacheIdentity = (cache: CacheSongInput, parsed: ParsedAudioCacheKey | null) => {
  if (parsed) return `${parsed.source}\0${parsed.id}`
  if (cache.source && cache.id) return `${cache.source}\0${cache.id}`
  return `\0${cache.cacheKey}`
}

/**
 * Drop partial caches. Several complete qualities of one song become one row,
 * keeping the best complete file.
 */
export const groupCompleteCaches = (caches: readonly CacheSongInput[]): CompleteCacheGroup[] => {
  const groups = new Map<string, {
    best: CacheSongInput | null
    bestRank: number
    keys: string[]
    parsed: ParsedAudioCacheKey | null
  }>()
  for (const cache of caches) {
    if (!cache.cacheKey) continue
    const parsed = parseAudioCacheKey(cache.cacheKey)
    const identity = cacheIdentity(cache, parsed)
    let group = groups.get(identity)
    if (!group) {
      group = { best: null, bestRank: -1, keys: [], parsed }
      groups.set(identity, group)
    }
    if (!group.keys.includes(cache.cacheKey)) group.keys.push(cache.cacheKey)
    if (!cache.fullyCached) continue
    const rank = qualityRank(parsed?.quality)
    const better = group.best == null ||
      rank > group.bestRank ||
      (rank == group.bestRank && cache.cachedBytes > group.best.cachedBytes)
    if (!better) continue
    group.best = cache
    group.bestRank = rank
    if (parsed) group.parsed = parsed
  }
  const rows: CompleteCacheGroup[] = []
  for (const group of groups.values()) {
    if (!group.best) continue
    const parsed = parseAudioCacheKey(group.best.cacheKey) ?? group.parsed
    rows.push({
      cacheKey: group.best.cacheKey,
      cacheKeys: group.keys,
      cachedBytes: group.best.cachedBytes,
      fullyCached: true,
      source: parsed?.source ?? group.best.source ?? null,
      id: parsed?.id ?? group.best.id ?? null,
      quality: parsed?.quality ?? null,
    })
  }
  return rows
}

const identityOf = (source: string, id: string) => `${source}_${id}`

/**
 * One list for the local page.
 * A song imported from the phone stays a device row even when its audio is also cached.
 * Only fully cached online songs are added, one row per song.
 */
export const mergeLocalSongRows = (
  devices: readonly DeviceSongInput[],
  caches: readonly CacheSongInput[],
): MergedLocalSong[] => {
  const seen = new Set<string>()
  const rows: MergedLocalSong[] = []
  for (const device of devices) {
    if (!device.id) continue
    const identity = identityOf(device.source, device.id)
    if (seen.has(identity)) continue
    seen.add(identity)
    rows.push({
      rowKey: `device:${identity}`,
      origin: 'device',
      source: device.source,
      id: device.id,
      size: device.size,
      fullyCached: null,
      cacheKey: null,
      cacheKeys: [],
      quality: null,
      playable: true,
    })
  }
  for (const cache of groupCompleteCaches(caches)) {
    const parsed = parseAudioCacheKey(cache.cacheKey)
    const source = cache.source ?? parsed?.source ?? null
    const id = cache.id ?? parsed?.id ?? null
    if (source && id && seen.has(identityOf(source, id))) continue
    if (source == 'local' && id) {
      const identity = identityOf(source, id)
      if (seen.has(identity)) continue
      seen.add(identity)
      rows.push({
        rowKey: `device:${identity}`,
        origin: 'device',
        source,
        id,
        size: null,
        fullyCached: null,
        cacheKey: cache.cacheKey,
        cacheKeys: cache.cacheKeys,
        quality: null,
        playable: true,
      })
      continue
    }
    rows.push({
      rowKey: `cache:${source && id ? identityOf(source, id) : cache.cacheKey}`,
      origin: 'cache',
      source: source ?? 'unknown',
      id: id ?? cache.cacheKey,
      size: cache.cachedBytes,
      fullyCached: true,
      cacheKey: cache.cacheKey,
      cacheKeys: cache.cacheKeys,
      quality: cache.quality,
      playable: Boolean(source && id && source != 'unknown'),
    })
  }
  return rows
}

export interface LocalSongUsage {
  count: number
  deviceBytes: number
  cacheBytes: number
  totalBytes: number
}

/** Sum the rows the page actually lists. Partial caches never reach this list. */
export const summarizeLocalSongUsage = (
  rows: ReadonlyArray<{ origin: LocalSongOrigin, size: number | null }>,
): LocalSongUsage => {
  let deviceBytes = 0
  let cacheBytes = 0
  for (const row of rows) {
    const size = row.size != null && row.size > 0 ? row.size : 0
    if (row.origin == 'device') deviceBytes += size
    else cacheBytes += size
  }
  return {
    count: rows.length,
    deviceBytes,
    cacheBytes,
    totalBytes: deviceBytes + cacheBytes,
  }
}

export const CACHE_LOOKUP_QUALITIES = ['128k', '320k', 'flac', 'flac24bit', '192k', 'ape', 'wav', 'local'] as const

export const cacheKeysForSong = (source: string, id: string, qualities: readonly string[] = CACHE_LOOKUP_QUALITIES) => {
  return qualities.map(quality => `${source}_${id}_${quality}`)
}

export const CACHED_META_LOOKUP_ORDER = ['userList', 'listenList', 'playHistory', 'metaStore', 'fetched', 'fallback'] as const

export type CachedMetaVia = typeof CACHED_META_LOOKUP_ORDER[number]

export interface CachedSongIdentity {
  id: string
  source: string
  name?: string
  singer?: string
  interval?: string | null
  meta?: {
    songId?: string | number | null
    albumName?: string
    picUrl?: string | null
    albumId?: string | number | null
    qualitys?: Array<{ type: string, size: string | null, hash?: string | null }>
    _qualitys?: Record<string, { size: string | null, hash?: string | null }>
    hash?: string | null
    strMediaMid?: string
  }
}

export interface ResolvedCachedSong<T> {
  via: CachedMetaVia
  parsed: ParsedAudioCacheKey | null
  musicInfo: T
}

export const songMatchesCacheKey = (
  song: CachedSongIdentity,
  parsed: ParsedAudioCacheKey,
): boolean => {
  if (!song?.source || song.source != parsed.source) return false
  if (song.id == parsed.id || song.id == parsed.songmid) return true
  const songId = song.meta?.songId
  if (songId != null && String(songId) == parsed.songmid) return true
  if (parsed.source != 'kg' && parsed.source != 'local' && song.id == `${parsed.source}_${parsed.songmid}`) return true
  return false
}

const usableCachedName = (song: CachedSongIdentity, cacheKey: string) => {
  const name = song.name?.trim() ?? ''
  if (!name || name == cacheKey) return false
  return true
}

const pickMatch = <T extends CachedSongIdentity>(
  songs: readonly T[] | undefined,
  parsed: ParsedAudioCacheKey,
): T | null => {
  if (!songs) return null
  let songmidHit: T | null = null
  for (const song of songs) {
    if (!usableCachedName(song, parsed.cacheKey) || !songMatchesCacheKey(song, parsed)) continue
    if (song.id == parsed.id) return song
    songmidHit ??= song
  }
  return songmidHit
}

/** Playback cache keys use the parsed id, even when a catalog row was stored under another id. */
export const alignCachedSong = <T extends CachedSongIdentity>(song: T, parsed: ParsedAudioCacheKey | null): T => {
  if (!parsed || (song.id == parsed.id && song.source == parsed.source)) return song
  return { ...song, id: parsed.id, source: parsed.source }
}

const fallbackMusic = (cacheKey: string, parsed: ParsedAudioCacheKey | null, unknownName: string): CachedSongIdentity => {
  const cleaned = fallbackCacheSongName(cacheKey)
  const quality = parsed && parsed.quality != 'local' ? parsed.quality : ''
  const hash = parsed?.hash ?? null
  return {
    id: parsed?.id ?? cacheKey,
    source: parsed?.source ?? 'unknown',
    name: cleaned || unknownName,
    singer: '',
    interval: null,
    meta: {
      songId: parsed?.songmid ?? '',
      albumName: '',
      picUrl: '',
      qualitys: quality ? [{ type: quality, size: null, hash }] : [],
      _qualitys: quality ? { [quality]: { size: null, hash } } : {},
      hash,
    },
  }
}

export interface ResolveCachedSongInput<T extends CachedSongIdentity> {
  cacheKey: string
  userLists?: readonly T[]
  listenList?: readonly T[]
  playHistory?: readonly T[]
  metaStore?: readonly T[]
  keyedMeta?: T | null
  fetched?: T | null
  unknownName?: string
}

const keyedMetaHit = <T extends CachedSongIdentity>(
  keyed: T | null | undefined,
  parsed: ParsedAudioCacheKey | null,
  cacheKey: string,
): T | null => {
  if (!keyed?.id || !keyed.source || !usableCachedName(keyed, cacheKey)) return null
  if (!parsed || songMatchesCacheKey(keyed, parsed)) return keyed
  return null
}

/**
 * Local catalogs first, then a fetched song, then a readable name that is not the cache key.
 * `keyedMeta` is the music info saved for this exact cache key and is part of `metaStore`.
 */
export const resolveCachedSongMetadata = <T extends CachedSongIdentity>(
  input: ResolveCachedSongInput<T>,
): ResolvedCachedSong<T | CachedSongIdentity> => {
  const parsed = parseAudioCacheKey(input.cacheKey)
  const trimmedName = input.unknownName?.trim()
  let unknownName = '未知歌曲'
  if (trimmedName) unknownName = trimmedName
  if (parsed) {
    const userHit = pickMatch(input.userLists, parsed)
    if (userHit) return { via: 'userList', parsed, musicInfo: userHit }
    const listenHit = pickMatch(input.listenList, parsed)
    if (listenHit) return { via: 'listenList', parsed, musicInfo: listenHit }
    const historyHit = pickMatch(input.playHistory, parsed)
    if (historyHit) return { via: 'playHistory', parsed, musicInfo: historyHit }
    const keyedHit = keyedMetaHit(input.keyedMeta, parsed, input.cacheKey)
    if (keyedHit) return { via: 'metaStore', parsed, musicInfo: keyedHit }
    const stored = pickMatch(input.metaStore, parsed)
    if (stored) return { via: 'metaStore', parsed, musicInfo: stored }
    const fetched = input.fetched
    if (fetched && songMatchesCacheKey(fetched, parsed) && usableCachedName(fetched, input.cacheKey)) {
      return { via: 'fetched', parsed, musicInfo: fetched }
    }
  } else {
    const keyedHit = keyedMetaHit(input.keyedMeta, null, input.cacheKey)
    if (keyedHit) return { via: 'metaStore', parsed, musicInfo: keyedHit }
  }
  return {
    via: 'fallback',
    parsed,
    musicInfo: fallbackMusic(input.cacheKey, parsed, unknownName),
  }
}
