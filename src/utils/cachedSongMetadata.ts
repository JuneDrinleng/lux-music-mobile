/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import {
  alignCachedSong,
  hasCachedSongMetadata,
  normalizeCachedSongId,
  resolveCachedSongMetadata,
  type CachedSongIdentity,
  type ParsedAudioCacheKey,
} from './localSongRows'
import { type PlayRecord } from './playHistory/types'

export interface CachedSongIndexEntry<T extends CachedSongIdentity> {
  key: string
  musicInfo: T
}

/** Concurrent hydration workers must update the latest index, not a snapshot read before await. */
export const createCachedSongIndex = <T extends CachedSongIdentity>(
  read: () => Promise<Array<CachedSongIndexEntry<T>>>,
  onChange: (entries: Array<CachedSongIndexEntry<T>>) => void,
) => {
  let memory: Array<CachedSongIndexEntry<T>> | null = null
  let loading: Promise<Array<CachedSongIndexEntry<T>>> | null = null
  const load = async(): Promise<Array<CachedSongIndexEntry<T>>> => {
    if (memory) return memory
    loading ??= read().then(entries => {
      memory = entries
      return entries
    }).finally(() => { loading = null })
    return await loading
  }
  return {
    load,
    remember: async(key: string, musicInfo: T) => {
      if (!key || !musicInfo?.id || !musicInfo.source || !hasCachedSongMetadata(musicInfo, key)) return
      await load()
      const next = (memory ?? []).filter(entry => entry.key != key)
      next.push({ key, musicInfo })
      memory = next.slice(-2000)
      onChange(memory)
    },
    forget: async(keys: readonly string[]) => {
      if (!keys.length) return
      const drop = new Set(keys)
      await load()
      memory = (memory ?? []).filter(entry => !drop.has(entry.key))
      onChange(memory)
    },
  }
}

/** Persisted listening history survives the player's temporary queue being cleared. */
export const cachedSongsFromPlayRecords = (records: readonly PlayRecord[]): CachedSongIdentity[] => {
  return records.map(({ song }) => {
    const songmid = normalizeCachedSongId(song.source, song.songmid)
    return {
      id: song.source == 'local' || song.source == 'kg' ? songmid : `${song.source}_${songmid}`,
      source: song.source,
      name: song.name,
      singer: song.singer,
      interval: song.interval ?? null,
      meta: {
        songId: songmid,
        albumName: song.albumName ?? '',
        picUrl: song.img ?? '',
        qualitys: [],
        _qualitys: {},
        ...(song.source == 'local' ? { filePath: songmid, ext: /\.(\w+)$/.exec(songmid)?.[1] ?? '' } : {}),
      },
    }
  })
}

export interface CachedSongMetadataFetcher<T extends CachedSongIdentity> {
  loadStored: () => Promise<readonly T[]>
  fetch: (parsed: ParsedAudioCacheKey) => Promise<T | null>
  prepare: (song: T, parsed: ParsedAudioCacheKey) => T
  persist: (cacheKey: string, song: T) => Promise<void>
}

/** Only missing metadata goes online. Share one request per song, then persist each cache key. */
export const createCachedSongMetadataFetcher = <T extends CachedSongIdentity>(deps: CachedSongMetadataFetcher<T>) => {
  const inflight = new Map<string, Promise<T | null>>()
  return async(parsed: ParsedAudioCacheKey): Promise<T | null> => {
    const stored = await deps.loadStored().catch(() => [] as T[])
    const local = resolveCachedSongMetadata({ cacheKey: parsed.cacheKey, metaStore: stored })
    if (local.via != 'fallback') return deps.prepare(alignCachedSong(local.musicInfo as T, parsed), parsed)
    const identity = `${parsed.source}\0${parsed.source == 'kg' ? parsed.id : parsed.songmid}`
    let pending = inflight.get(identity)
    if (!pending) {
      pending = deps.fetch(parsed).catch(() => null)
      inflight.set(identity, pending)
    }
    try {
      const fetched = await pending
      const resolved = resolveCachedSongMetadata({ cacheKey: parsed.cacheKey, fetched })
      if (resolved.via != 'fetched') return null
      const song = deps.prepare(alignCachedSong(resolved.musicInfo as T, parsed), parsed)
      await deps.persist(parsed.cacheKey, song)
      return song
    } catch {
      return null
    } finally {
      if (inflight.get(identity) == pending) inflight.delete(identity)
    }
  }
}
