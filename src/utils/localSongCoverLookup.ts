/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

// Lux Proprietary

import AsyncStorage from '@react-native-async-storage/async-storage'

import musicSdk, { searchMusic } from '@/utils/musicSdk'
import { cacheImageUri, pinImageUrl } from '@/utils/imageCache'
import { readPic } from '@/utils/localMediaMetadata'
import { isUsableSongCoverUrl, toPlaylistThumbUrl } from '@/utils/playlistCoverMap'
import {
  coverMatchScore,
  decideLocalCoverCache,
  parseLocalCoverCache,
  parseLocalSongIdentity,
  pruneLocalCoverCache,
  serializeLocalCoverCache,
  type LocalCoverCacheRecord,
  type LocalSongIdentity,
} from '@/utils/localSongCoverMatch'

export const LOCAL_SONG_COVER_CONCURRENCY = 2
const STORAGE_KEY = 'lx_local_song_cover_cache'
const SEARCH_LIMIT = 15
const MAX_PIC_ATTEMPTS = 3

interface SearchHit {
  name?: string
  singer?: string
  source?: string
  img?: string | null
  songmid?: string | number
  albumId?: string | number
  hash?: string
  audioId?: string
  interval?: string | null
}

let cache: Record<string, LocalCoverCacheRecord> = {}
let loaded = false
let loading: Promise<void> | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null
const embeddedMemory = new Map<string, string | null>()
const inflight = new Map<string, Promise<string | null>>()
let embeddedReadChain: Promise<unknown> = Promise.resolve()
let active = 0
const waiters: Array<() => void> = []

export const deviceSongCoverKey = (song: { id?: string | null, meta?: { filePath?: string | null } }): string => {
  const path = song.meta?.filePath?.trim() ?? ''
  if (path) return path
  return song.id?.trim() ?? ''
}

const scheduleSave = () => {
  if (saveTimer) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    const pruned = pruneLocalCoverCache(cache, Date.now())
    cache = pruned
    void AsyncStorage.setItem(STORAGE_KEY, serializeLocalCoverCache(pruned)).catch(() => {})
  }, 400)
}

export const loadDeviceSongCoverStore = async() => {
  if (loaded) return
  if (!loading) {
    loading = (async() => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY)
        cache = pruneLocalCoverCache(parseLocalCoverCache(raw), Date.now())
      } catch {
        cache = {}
      }
      loaded = true
    })().finally(() => {
      loading = null
    })
  }
  await loading
}

const remember = (key: string, url: string | null) => {
  if (!key) return
  cache = {
    ...cache,
    [key]: { url, savedAt: Date.now() },
  }
  scheduleSave()
}

const pinRemoteCover = (url: string) => {
  pinImageUrl(url)
  const thumb = toPlaylistThumbUrl(url)
  if (thumb != url) pinImageUrl(thumb)
  void cacheImageUri(url, { pin: true })
  if (thumb != url) void cacheImageUri(thumb, { pin: true })
}

const readEmbedded = async(song: LX.Music.MusicInfoLocal, key: string): Promise<string | null> => {
  if (embeddedMemory.has(key)) return embeddedMemory.get(key) ?? null
  const filePath = song.meta.filePath || (song.id.startsWith('/') ? song.id : '')
  if (!filePath) {
    embeddedMemory.set(key, null)
    return null
  }
  const read = embeddedReadChain.then(async() => readPic(filePath), async() => readPic(filePath))
  embeddedReadChain = read.then(() => {}, () => {})
  let pic = await read.catch(() => '')
  if (pic && pic.startsWith('/')) pic = `file://${pic}`
  const url = pic || null
  embeddedMemory.set(key, url)
  return url
}

const identityOf = (song: LX.Music.MusicInfoLocal): LocalSongIdentity => {
  return parseLocalSongIdentity({
    title: song.name,
    artist: song.singer,
    fileName: song.meta.filePath || song.id,
  })
}

const picFromHit = async(hit: SearchHit): Promise<string | null> => {
  const source = hit.source ?? ''
  const sdk = (musicSdk as Record<string, { getPic?: (info: SearchHit) => Promise<string | null> | string | null } | undefined>)[source]
  if (sdk?.getPic) {
    try {
      const raw = await sdk.getPic(hit)
      if (isUsableSongCoverUrl(raw, source)) return raw.trim()
    } catch {}
  }
  if (isUsableSongCoverUrl(hit.img, source)) return hit.img.trim()
  return null
}

const searchCover = async(identity: LocalSongIdentity): Promise<string | null> => {
  const lists = await searchMusic({
    name: identity.name,
    singer: identity.singer,
    source: 'local',
    limit: SEARCH_LIMIT,
  }).catch(() => []) as Array<{ list?: SearchHit[] } | null>
  const ranked: Array<{ hit: SearchHit, score: number, index: number }> = []
  let index = 0
  for (const list of lists ?? []) {
    for (const hit of list?.list ?? []) {
      const score = coverMatchScore(identity, {
        name: hit?.name ?? '',
        singer: hit?.singer ?? '',
      })
      if (score > 0) ranked.push({ hit, score, index })
      index += 1
    }
  }
  ranked.sort((a, b) => b.score - a.score || a.index - b.index)
  const attempts = ranked.slice(0, MAX_PIC_ATTEMPTS)
  for (const item of attempts) {
    const url = await picFromHit(item.hit)
    if (url) return url
  }
  return null
}

const resolveNow = async(
  song: LX.Music.MusicInfoLocal,
  options?: { skipEmbedded?: boolean, bypassCache?: boolean },
): Promise<string | null> => {
  if (song.source != 'local') return null
  const key = deviceSongCoverKey(song)
  if (!key) return null
  await loadDeviceSongCoverStore()
  if (!options?.skipEmbedded) {
    const embedded = await readEmbedded(song, key)
    if (embedded) return embedded
  }
  if (!options?.bypassCache) {
    const decision = decideLocalCoverCache(cache[key], Date.now())
    if (decision == 'use') return cache[key].url
    if (decision == 'skip') return null
    const existing = song.meta.picUrl?.trim()
    if (existing && isUsableSongCoverUrl(existing, 'local')) return existing
  }
  const identity = identityOf(song)
  if (!identity.name || !identity.singer) return null
  let url: string | null = null
  let searched = false
  try {
    url = await searchCover(identity)
    searched = true
  } catch {
    searched = false
  }
  if (url) {
    remember(key, url)
    pinRemoteCover(url)
    return url
  }
  if (searched) remember(key, null)
  return null
}

export const resolveDeviceSongCover = async(
  song: LX.Music.MusicInfoLocal,
  options?: { skipEmbedded?: boolean, bypassCache?: boolean },
): Promise<string | null> => {
  const key = deviceSongCoverKey(song)
  if (!options?.bypassCache && key) {
    const existing = inflight.get(key)
    if (existing) return existing
  }
  const promise = resolveNow(song, options)
  if (!options?.bypassCache && key) {
    inflight.set(key, promise)
    void promise.finally(() => {
      if (inflight.get(key) == promise) inflight.delete(key)
    })
  }
  return promise
}

const acquire = async() => {
  if (active < LOCAL_SONG_COVER_CONCURRENCY) {
    active += 1
    return
  }
  await new Promise<void>(resolve => {
    waiters.push(() => {
      active += 1
      resolve()
    })
  })
}

const release = () => {
  active = Math.max(0, active - 1)
  const next = waiters.shift()
  if (next) next()
}

/** Start a lookup when a device-song row is on screen. Concurrent searches stay capped. */
export const requestDeviceSongCover = async(song: LX.Music.MusicInfoLocal): Promise<string | null> => {
  await acquire()
  try {
    return await resolveDeviceSongCover(song)
  } finally {
    release()
  }
}
