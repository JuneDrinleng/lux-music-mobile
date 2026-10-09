/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { Image } from 'react-native'
import { LIST_IDS } from '@/config/constant'
import { getListMusics } from '@/core/list'
import playerState from '@/store/player/state'
import listState from '@/store/list/state'
import { peekBootedLuxTheme, primeLuxThemeForBoot } from '@/theme/LuxTheme'
import { cacheImageUri, peekCachedImageUri, pinImageUrl, primeImageCacheIndex } from '@/utils/imageCache'
import {
  collectHomeWarmUrls,
  homeBootRevealAt,
  homeCoverSettleAt,
  resolveHomeListCover,
  selectHomeFirstListIds,
  type HomeCoverSong,
} from '@/utils/homeBootGate'
import { loadPlaylistCoverStore, peekPlaylistCover } from '@/utils/playlistCoverStore'

export interface HomeListMeta {
  count: number
  cover: string | null
}

export interface HomeBootHandle {
  mount: Promise<void>
  covers: Promise<void>
}

const HTTP_URL = /^https?:\/\//i

let meta: Record<string, HomeListMeta> | null = null
let splashArmed = false
let revealed = false
let splashHidden = false
let handle: HomeBootHandle | null = null
const metaListeners = new Set<() => void>()
const revealListeners = new Set<() => void>()
const hiddenListeners = new Set<() => void>()

const coverLookup = {
  mapped: (song: HomeCoverSong) => peekPlaylistCover(song.source, song.id),
  isCached: (url: string) => peekCachedImageUri(url) != null,
}

export const toHomeCoverSong = (song: LX.Music.MusicInfo): HomeCoverSong => ({
  source: song.source,
  id: song.id,
  picUrl: song.meta.picUrl,
  togglePicUrl: song.meta.toggleMusicInfo?.meta.picUrl ?? null,
  albumId: song.source == 'local' || !('albumId' in song.meta) ? null : song.meta.albumId ?? null,
})

export const getHomePlaylistMetaSnapshot = (): Record<string, HomeListMeta> => meta ?? {}

export const subscribeHomePlaylistMeta = (listener: () => void) => {
  metaListeners.add(listener)
  return () => {
    metaListeners.delete(listener)
  }
}

const publishMeta = (next: Record<string, HomeListMeta>) => {
  meta = next
  for (const listener of metaListeners) listener()
}

export const primeHomeBootTheme = async() => primeLuxThemeForBoot()

export const armHomeBootSplash = () => {
  splashArmed = true
  splashHidden = false
}

export const shouldShowHomeBootSplash = () => splashArmed && !revealed

export const shouldHoldSplashChrome = () => splashArmed && !splashHidden

export const isHomeBootRevealed = () => revealed || !splashArmed

export const subscribeHomeBootReveal = (listener: () => void) => {
  if (isHomeBootRevealed()) {
    listener()
    return () => {}
  }
  revealListeners.add(listener)
  return () => {
    revealListeners.delete(listener)
  }
}

export const markHomeBootRevealed = () => {
  if (revealed) return
  revealed = true
  const listeners = [...revealListeners]
  revealListeners.clear()
  for (const listener of listeners) listener()
}

export const notifyHomeBootSplashHidden = () => {
  if (splashHidden) return
  splashHidden = true
  const listeners = [...hiddenListeners]
  hiddenListeners.clear()
  for (const listener of listeners) listener()
}

export const subscribeHomeBootSplashHidden = (listener: () => void) => {
  if (!shouldHoldSplashChrome()) {
    listener()
    return () => {}
  }
  hiddenListeners.add(listener)
  return () => {
    hiddenListeners.delete(listener)
  }
}

export const peekHomeBootBackground = () => peekBootedLuxTheme().colors.bg.app

const songPic = (song: LX.Music.MusicInfo | null | undefined) => {
  const pic = song?.meta.picUrl
  if (typeof pic != 'string') return null
  const trimmed = pic.trim()
  return trimmed || null
}

const readPlayingCover = () => {
  const urls: string[] = []
  const pic = playerState.musicInfo.pic
  if (typeof pic == 'string' && pic.trim()) {
    urls.push(pic.startsWith('/') ? `file://${pic}` : pic.trim())
  }
  const music = playerState.playMusicInfo.musicInfo
  if (music && 'metadata' in music) urls.push(songPic(music.metadata.musicInfo) ?? '')
  else if (music && 'meta' in music) urls.push(songPic(music) ?? '')
  return urls.filter(Boolean)
}

const warmUrl = async(url: string) => {
  if (!HTTP_URL.test(url)) {
    await Image.prefetch(url).catch(() => {})
    return
  }
  pinImageUrl(url)
  const existing = peekCachedImageUri(url)
  const fileUri = existing ?? await cacheImageUri(url, { pin: true }).catch(() => null)
  await Image.prefetch(fileUri ?? url).catch(() => {})
}

const loadCounts = async() => {
  const ids = selectHomeFirstListIds(listState.allList, { love: LIST_IDS.LOVE, fallback: LIST_IDS.DEFAULT })
  const next: Record<string, HomeListMeta> = {}
  await Promise.all(ids.map(async id => {
    try {
      const songs = await getListMusics(id)
      next[id] = {
        count: songs.length,
        cover: resolveHomeListCover(songs.map(toHomeCoverSong), coverLookup),
      }
    } catch {
      // Leave the id out so the row does not claim zero songs.
    }
  }))
  publishMeta(next)
  return next
}

const warmCovers = async(next: Record<string, HomeListMeta>) => {
  const urls = collectHomeWarmUrls([
    ...Object.values(next).map(item => item.cover),
    ...readPlayingCover(),
  ])
  const hadCacheMiss = urls.some(url => HTTP_URL.test(url) && peekCachedImageUri(url) == null)
  if (!urls.length) return
  if (!hadCacheMiss) {
    // Files are already on disk. Decoding happens while the splash is still up.
    void Promise.all(urls.map(async url => warmUrl(url)))
    return
  }
  await Promise.all(urls.map(async url => warmUrl(url)))
  const finishedAt = Date.now()
  const remain = homeCoverSettleAt(finishedAt, true) - finishedAt
  if (remain > 0) await new Promise<void>(resolve => { setTimeout(resolve, remain) })
}

const runBoot = async(resolveMount: () => void, resolveCovers: () => void) => {
  let next: Record<string, HomeListMeta> = {}
  try {
    await Promise.all([
      primeImageCacheIndex().catch(() => {}),
      loadPlaylistCoverStore().catch(() => {}),
      primeLuxThemeForBoot().catch(() => {}),
    ])
    next = await loadCounts()
  } catch {
    next = getHomePlaylistMetaSnapshot()
  }
  resolveMount()
  try {
    await warmCovers(next)
  } catch {
    // The splash deadline still reveals. Uncached covers follow the placeholder fade.
  }
  resolveCovers()
}

export const startHomeFirstScreenBoot = (): HomeBootHandle => {
  if (handle) return handle
  let resolveMount = () => {}
  let resolveCovers = () => {}
  const mount = new Promise<void>(resolve => {
    resolveMount = resolve
  })
  const covers = new Promise<void>(resolve => {
    resolveCovers = resolve
  })
  handle = { mount, covers }
  void runBoot(resolveMount, resolveCovers)
  return handle
}

export const raceWithDeadline = async(work: Promise<void>, deadlineAt: number) => new Promise<void>(resolve => {
  let settled = false
  let timer: ReturnType<typeof setTimeout> | null = null
  const finish = () => {
    if (settled) return
    settled = true
    if (timer != null) clearTimeout(timer)
    resolve()
  }
  const remain = deadlineAt - Date.now()
  if (remain <= 0) {
    finish()
    return
  }
  timer = setTimeout(finish, remain)
  void work.then(finish, finish)
})

export const waitUntilHomeBootReveal = async(input: {
  launchStartedAt: number
  preloadStartedAt: number
  covers: Promise<void>
}) => new Promise<void>(resolve => {
  let readyAt: number | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let settled = false
  const schedule = () => {
    if (timer != null) clearTimeout(timer)
    const now = Date.now()
    const revealAt = homeBootRevealAt({
      launchStartedAt: input.launchStartedAt,
      preloadStartedAt: input.preloadStartedAt,
      readyAt,
    })
    if (now >= revealAt) {
      settled = true
      resolve()
      return
    }
    timer = setTimeout(schedule, revealAt - now)
  }
  void input.covers.then(() => {
    if (settled) return
    readyAt = Date.now()
    schedule()
  }, () => {
    if (settled) return
    readyAt = Date.now()
    schedule()
  })
  schedule()
})
