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
  playable: boolean
}

const identityOf = (source: string, id: string) => `${source}_${id}`

/**
 * One list for the local page.
 * A song imported from the phone stays a device row even when its audio is also cached.
 * Cache rows are online songs (or unknown cache keys) that are not already shown as device files.
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
      playable: true,
    })
  }
  const cacheSeen = new Set<string>()
  for (const cache of caches) {
    if (!cache.cacheKey || cacheSeen.has(cache.cacheKey)) continue
    cacheSeen.add(cache.cacheKey)
    if (cache.source && cache.id && seen.has(identityOf(cache.source, cache.id))) continue
    if (cache.source == 'local' && cache.id) {
      const identity = identityOf(cache.source, cache.id)
      if (seen.has(identity)) continue
      seen.add(identity)
      rows.push({
        rowKey: `device:${identity}`,
        origin: 'device',
        source: cache.source,
        id: cache.id,
        size: null,
        fullyCached: null,
        cacheKey: cache.cacheKey,
        playable: true,
      })
      continue
    }
    rows.push({
      rowKey: `cache:${cache.cacheKey}`,
      origin: 'cache',
      source: cache.source ?? 'local',
      id: cache.id ?? cache.cacheKey,
      size: cache.cachedBytes,
      fullyCached: cache.fullyCached,
      cacheKey: cache.cacheKey,
      playable: Boolean(cache.source && cache.id),
    })
  }
  return rows
}

export const CACHE_LOOKUP_QUALITIES = ['128k', '320k', 'flac', 'flac24bit', '192k', 'ape', 'wav', 'local'] as const

export const cacheKeysForSong = (source: string, id: string, qualities: readonly string[] = CACHE_LOOKUP_QUALITIES) => {
  return qualities.map(quality => `${source}_${id}_${quality}`)
}
