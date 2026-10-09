/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

// Lux Proprietary

import { LIST_IDS } from '@/config/constant'
import { getListMusics } from '@/core/list'
import listState from '@/store/list/state'
import { allMusicList } from '@/utils/listManage'
import musicSdk from '@/utils/musicSdk'
import { toOldMusicInfo } from '@/utils'
import { cacheImageUri, peekCachedImageUri, pinImageUrl, trimUnpinnedImageCache, unpinImageUrl } from '@/utils/imageCache'
import { isActiveNetworkUnmetered, onNetworkUnmeteredChange } from '@/utils/nativeModules/utils'
import {
  BACKGROUND_COVER_CONCURRENCY,
  PLAYLIST_COVER_CONCURRENCY,
  type CoverQueueJob,
  type PlaylistCoverPriority,
  PlaylistCoverQueue,
  VISIBLE_COVER_CONCURRENCY,
} from '@/utils/playlistCoverQueue'
import {
  becameUnmetered,
  collectFallbackPicUrls,
  decideBackgroundCoverLane,
  isUsableSongCoverUrl,
  planSongCover,
  playlistCoverKey,
  toPlaylistThumbUrl,
} from '@/utils/playlistCoverMap'
import {
  listPlaylistCoverEntries,
  notifyPlaylistCover,
  peekPlaylistCover,
  prunePlaylistCoverStore,
  writePlaylistCover,
} from '@/utils/playlistCoverStore'

interface CoverWork {
  song: LX.Music.MusicInfo
  canonicalUrl: string | null
  rejectUrls: ReadonlySet<string>
  pin: boolean
}

const queue = new PlaylistCoverQueue()
const workByKey = new Map<string, CoverWork>()
const inflight = new Set<string>()
const inflightPriority = new Map<string, PlaylistCoverPriority>()

let visibleRunning = 0
let playlistRunning = 0
let backgroundRunning = 0
let pumping = false
let pumpAgain = false
let pumpScheduled = false
let listenersInstalled = false
let focusedListId: string | null = null
let fullScanTimer: ReturnType<typeof setTimeout> | null = null
let networkTimer: ReturnType<typeof setTimeout> | null = null
let networkCheckedAt = 0
let networkUnmetered = false
let networkGeneration = 0
let scanning = false
let scanAgain = false
let retainedDirty = true
const retainedSongKeys = new Set<string>()

const NETWORK_TTL_MS = 20_000
const NETWORK_RECHECK_MS = 30_000
const YIELD_EVERY = 24

const yieldToUi = async() => {
  await new Promise<void>(resolve => { setTimeout(resolve, 0) })
}

const refreshUnmetered = async() => {
  const now = Date.now()
  if (now - networkCheckedAt < NETWORK_TTL_MS) return networkUnmetered
  const generation = networkGeneration + 1
  networkGeneration = generation
  networkCheckedAt = now
  const unmetered = await isActiveNetworkUnmetered()
  if (generation != networkGeneration) return networkUnmetered
  networkUnmetered = unmetered
  return unmetered
}

const scheduleNetworkRecheck = () => {
  if (networkTimer) return
  networkTimer = setTimeout(() => {
    networkTimer = null
    schedulePump()
  }, NETWORK_RECHECK_MS)
}

const enqueueKey = (key: string, priority: PlaylistCoverPriority, now: number) => {
  if (inflight.has(key)) {
    const current = inflightPriority.get(key) ?? 'background'
    if (priority == 'visible' || (priority == 'playlist' && current == 'background')) {
      inflightPriority.set(key, priority)
    }
    return
  }
  queue.enqueue(key, priority, now)
}

const albumIdOf = (song: LX.Music.MusicInfo) => song.source == 'local' ? null : song.meta.albumId

const rebuildRetainedSongKeys = () => {
  retainedSongKeys.clear()
  for (const list of listState.allList) {
    const songs = allMusicList.get(list.id)
    if (!songs) continue
    for (const song of songs) {
      if (!song?.id || song.source == 'local') continue
      retainedSongKeys.add(playlistCoverKey(song.source, song.id))
    }
  }
  retainedDirty = false
}

/** Covers of songs in persisted user lists (试听、收藏、自建) stay pinned. */
export const isRetainedPlaylistSong = (source: string, id: string) => {
  if (retainedDirty) rebuildRetainedSongKeys()
  return retainedSongKeys.has(playlistCoverKey(source, id))
}

const markRetainedDirty = () => {
  retainedDirty = true
}

const enqueueSongs = (
  songs: readonly LX.Music.MusicInfo[],
  priority: PlaylistCoverPriority,
  rejectUrls: ReadonlySet<string>,
  pin: boolean,
) => {
  const now = Date.now()
  for (const song of songs) {
    if (!song?.id || song.source == 'local') continue
    const key = playlistCoverKey(song.source, song.id)
    const mapped = peekPlaylistCover(song.source, song.id)
    const trustedMapped = mapped && !rejectUrls.has(mapped.url) ? mapped : null
    if (trustedMapped && peekCachedImageUri(trustedMapped.thumbUrl)) {
      if (pin) pinImageUrl(trustedMapped.thumbUrl)
      continue
    }
    const picUrl = typeof song.meta.picUrl == 'string' ? song.meta.picUrl.trim() : ''
    // kg/kw list payloads usually have no artwork. A picUrl on those songs is often the
    // playlist-cover fallback, so resolve the source URL unless we already stored one.
    const sourceCanTrustPic = song.source == 'wy' || song.source == 'tx' || song.source == 'mg'
    const trustPicUrl = sourceCanTrustPic && Boolean(picUrl) && isUsableSongCoverUrl(picUrl, song.source) && !rejectUrls.has(picUrl)
    const plan = planSongCover({
      source: song.source,
      id: song.id,
      picUrl: song.meta.picUrl,
      albumId: albumIdOf(song),
      mappedUrl: trustedMapped?.url ?? null,
      trustPicUrl,
    })
    if (plan.canonicalUrl && !trustedMapped) writePlaylistCover(song.source, song.id, plan.canonicalUrl, now, rejectUrls)
    if (plan.canonicalUrl && plan.thumbUrl && peekCachedImageUri(plan.thumbUrl)) {
      if (pin) pinImageUrl(plan.thumbUrl)
      continue
    }
    // Visible rows already on screen must not wait behind the library queue.
    if (plan.thumbUrl && priority == 'visible') {
      if (pin) pinImageUrl(plan.thumbUrl)
      void cacheImageUri(plan.thumbUrl, { pin }).then(saved => {
        if (saved) notifyPlaylistCover(song.source, song.id)
      }).catch(() => {})
    }
    const previous = workByKey.get(key)
    workByKey.set(key, {
      song,
      canonicalUrl: plan.canonicalUrl,
      rejectUrls,
      pin: pin || Boolean(previous?.pin),
    })
    enqueueKey(key, priority, now)
  }
}

export const prioritizePlaylistCovers = (
  songs: readonly LX.Music.MusicInfo[],
  priority: PlaylistCoverPriority,
  pin = false,
) => {
  if (!songs.length) return
  const rejectUrls = collectFallbackPicUrls(songs.map(song => ({
    picUrl: song.meta.picUrl,
    albumId: albumIdOf(song),
  })))
  let index = 0
  const step = () => {
    const end = Math.min(songs.length, index + YIELD_EVERY)
    enqueueSongs(songs.slice(index, end), priority, rejectUrls, pin)
    index = end
    schedulePump()
    if (index < songs.length) setTimeout(step, 0)
  }
  step()
}

const resolveSourceCoverUrl = async(song: LX.Music.MusicInfo): Promise<string | null> => {
  if (song.source == 'local') return null
  try {
    const sdk = (musicSdk as Record<string, { getPic?: (info: unknown) => Promise<string | null> | string | null } | undefined>)[song.source]
    if (!sdk?.getPic) return null
    const url = await sdk.getPic(toOldMusicInfo(song))
    if (!isUsableSongCoverUrl(url, song.source)) return null
    return url.trim()
  } catch {
    return null
  }
}

const resolveWorkUrl = async(work: CoverWork): Promise<string | null> => {
  if (work.canonicalUrl && isUsableSongCoverUrl(work.canonicalUrl, work.song.source)) {
    const canonical = work.canonicalUrl.trim()
    if (!work.rejectUrls.has(canonical)) return canonical
  }
  const resolved = await resolveSourceCoverUrl(work.song)
  if (!resolved || work.rejectUrls.has(resolved)) return null
  return resolved
}

const runJob = async(job: CoverQueueJob) => {
  const work = workByKey.get(job.key)
  if (!work) return
  try {
    const canonical = await resolveWorkUrl(work)
    if (!canonical) throw new Error('cover resolve failed')
    writePlaylistCover(work.song.source, work.song.id, canonical, Date.now(), work.rejectUrls)
    const entry = peekPlaylistCover(work.song.source, work.song.id)
    const thumb = entry?.thumbUrl ?? toPlaylistThumbUrl(canonical, work.song.source)
    if (work.pin) pinImageUrl(thumb)
    const saved = await cacheImageUri(thumb, { pin: work.pin })
    if (!saved) throw new Error('cover download failed')
    notifyPlaylistCover(work.song.source, work.song.id)
    workByKey.delete(job.key)
  } catch {
    const priority = inflightPriority.get(job.key) ?? job.priority
    const result = queue.fail({ ...job, priority }, Date.now())
    if (result == 'drop') workByKey.delete(job.key)
  }
}

const startJob = (job: CoverQueueJob, lane: PlaylistCoverPriority) => {
  inflight.add(job.key)
  inflightPriority.set(job.key, job.priority)
  if (lane == 'visible') visibleRunning += 1
  else if (lane == 'playlist') playlistRunning += 1
  else backgroundRunning += 1
  void runJob(job).finally(() => {
    inflight.delete(job.key)
    inflightPriority.delete(job.key)
    if (lane == 'visible') visibleRunning -= 1
    else if (lane == 'playlist') playlistRunning -= 1
    else backgroundRunning -= 1
    schedulePump()
  })
}

const fillLane = (priority: PlaylistCoverPriority, running: number, limit: number, now: number) => {
  let started = 0
  while (running + started < limit) {
    const job = queue.take(now, [priority])
    if (!job) break
    startJob(job, priority)
    started += 1
  }
}

const laneSnapshot = (unmetered: boolean) => ({
  unmetered,
  visibleRunning,
  playlistRunning,
  backgroundRunning,
  backgroundLimit: BACKGROUND_COVER_CONCURRENCY,
  visibleReady: queue.hasReady('visible', Date.now()),
  playlistReady: queue.hasReady('playlist', Date.now()),
  backgroundReady: queue.hasReady('background', Date.now()),
})

const pumpOnce = async() => {
  const now = Date.now()
  fillLane('visible', visibleRunning, VISIBLE_COVER_CONCURRENCY, now)
  if (visibleRunning > 0 || queue.hasReady('visible', Date.now())) return
  fillLane('playlist', playlistRunning, PLAYLIST_COVER_CONCURRENCY, now)
  if (decideBackgroundCoverLane(laneSnapshot(true)) != 'start') return
  const unmetered = await refreshUnmetered()
  const decision = decideBackgroundCoverLane(laneSnapshot(unmetered))
  if (decision == 'defer-foreground') {
    schedulePump()
    return
  }
  if (decision == 'defer-metered') {
    scheduleNetworkRecheck()
    return
  }
  if (decision != 'start') return
  fillLane('background', backgroundRunning, BACKGROUND_COVER_CONCURRENCY, Date.now())
}

const pump = () => {
  if (pumping) {
    pumpAgain = true
    return
  }
  pumping = true
  void pumpOnce().finally(() => {
    pumping = false
    if (!pumpAgain) return
    pumpAgain = false
    pump()
  })
}

const schedulePump = () => {
  if (pumpScheduled) return
  pumpScheduled = true
  setTimeout(() => {
    pumpScheduled = false
    pump()
  }, 0)
}

const snapshotLiveKeys = (): Set<string> | null => {
  const keys = new Set<string>()
  for (const list of listState.allList) {
    const songs = allMusicList.get(list.id)
    if (!songs) return null
    for (const song of songs) {
      if (song.source == 'local') continue
      keys.add(playlistCoverKey(song.source, song.id))
    }
  }
  return keys
}

const forgetRemovedEntries = (entries: Array<{ source: string, id: string, thumbUrl: string, url: string }>) => {
  for (const entry of entries) {
    const key = playlistCoverKey(entry.source, entry.id)
    queue.forget(key)
    workByKey.delete(key)
    unpinImageUrl(entry.thumbUrl)
  }
}

const pruneLoadedLists = () => {
  const live = snapshotLiveKeys()
  if (!live) return
  forgetRemovedEntries(prunePlaylistCoverStore(live))
}

const shouldTrackList = (listId: string) => {
  return Boolean(listId) && listId != LIST_IDS.TEMP && listId != LIST_IDS.DOWNLOAD
}

const priorityForList = (listId: string): PlaylistCoverPriority => {
  return listId == focusedListId ? 'playlist' : 'background'
}

const scanUserPlaylistCovers = async() => {
  const ids = listState.allList.map(list => list.id)
  let seen = 0
  for (const listId of ids) {
    const songs = await getListMusics(listId)
    prioritizePlaylistCovers(songs, priorityForList(listId), true)
    seen += songs.length
    if (seen >= YIELD_EVERY) {
      seen = 0
      await yieldToUi()
    }
  }
  pruneLoadedLists()
  await trimUnpinnedImageCache()
}

export const prefetchUserPlaylistCovers = () => {
  if (scanning) {
    scanAgain = true
    return
  }
  scanning = true
  void scanUserPlaylistCovers().finally(() => {
    scanning = false
    if (!scanAgain) return
    scanAgain = false
    prefetchUserPlaylistCovers()
  })
}

const scheduleFullScan = () => {
  if (fullScanTimer) clearTimeout(fullScanTimer)
  fullScanTimer = setTimeout(() => {
    fullScanTimer = null
    prefetchUserPlaylistCovers()
  }, 1000)
}

const onListAdd = (listId: string, musicInfos: LX.Music.MusicInfo[]) => {
  markRetainedDirty()
  if (!shouldTrackList(listId)) return
  prioritizePlaylistCovers(musicInfos, priorityForList(listId), true)
}

const onListMove = (fromId: string, toId: string, musicInfos: LX.Music.MusicInfo[]) => {
  markRetainedDirty()
  if (shouldTrackList(toId)) prioritizePlaylistCovers(musicInfos, priorityForList(toId), true)
  if (shouldTrackList(fromId)) pruneLoadedLists()
}

const onListOverwrite = (listId: string, musicInfos: LX.Music.MusicInfo[]) => {
  markRetainedDirty()
  if (!shouldTrackList(listId)) return
  prioritizePlaylistCovers(musicInfos, priorityForList(listId), true)
  pruneLoadedLists()
}

const onListRemoveSongs = (listId: string) => {
  markRetainedDirty()
  if (!shouldTrackList(listId)) return
  pruneLoadedLists()
}

const onListDataOverwrite = () => {
  markRetainedDirty()
  scheduleFullScan()
}

const onListRemoved = () => {
  markRetainedDirty()
  pruneLoadedLists()
}

const onNetworkChange = (unmetered: boolean) => {
  const previous = networkUnmetered
  networkGeneration += 1
  networkCheckedAt = Date.now()
  networkUnmetered = unmetered
  if (becameUnmetered(previous, unmetered)) prefetchUserPlaylistCovers()
  else schedulePump()
}

export const installPlaylistCoverPrefetch = () => {
  if (listenersInstalled) return
  listenersInstalled = true
  onNetworkUnmeteredChange(onNetworkChange)
  global.list_event.on('list_music_add', onListAdd)
  global.list_event.on('list_music_move', onListMove)
  global.list_event.on('list_music_overwrite', onListOverwrite)
  global.list_event.on('list_music_remove', onListRemoveSongs)
  global.list_event.on('list_music_clear', onListRemoved)
  global.list_event.on('list_remove', onListRemoved)
  global.list_event.on('list_data_overwrite', onListDataOverwrite)
}

export const setPlaylistCoverFocus = (listId: string | null) => {
  focusedListId = listId
}

export const demoteOpenPlaylistCoverWork = () => {
  queue.demote('visible', 'background')
  queue.demote('playlist', 'background')
  schedulePump()
}

export const pinStoredPlaylistCovers = () => {
  markRetainedDirty()
  for (const entry of listPlaylistCoverEntries()) {
    if (!isRetainedPlaylistSong(entry.source, entry.id)) continue
    pinImageUrl(entry.thumbUrl)
    if (entry.url && entry.url != entry.thumbUrl) pinImageUrl(entry.url)
  }
}

export const runIdlePlaylistCoverPrefetch = () => {
  pinStoredPlaylistCovers()
  prefetchUserPlaylistCovers()
}

export const restorePlaylistCoverCache = () => {
  pinStoredPlaylistCovers()
  if (focusedListId) {
    void getListMusics(focusedListId).then(songs => {
      prioritizePlaylistCovers(songs, 'playlist', Boolean(focusedListId && shouldTrackList(focusedListId)))
    }).catch(() => {})
  }
  scheduleFullScan()
}
