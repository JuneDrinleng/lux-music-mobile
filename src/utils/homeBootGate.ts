/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { resolvePlaylistRowCover } from './playlistCoverMap'

const LOVE_LIST_ID = 'love'
const DEFAULT_LIST_ID = 'default'

/**
 * Splash stays up for the existing 3500ms hold. Preload starts when init finishes
 * and is given 2500ms. Anything still running when that budget ends can borrow at
 * most 1500ms after the hold, and never past whichever bound comes first.
 * A warm cache finishes inside the hold, so the extra wait is zero.
 */
export const HOME_LAUNCH_HOLD_MS = 3500
export const HOME_BOOT_EXTRA_WAIT_MS = 1500
export const HOME_BOOT_PRELOAD_BUDGET_MS = 2500
/** Matches the cover fade used when a file was not ready on the first paint. */
export const HOME_BOOT_COVER_FADE_MS = 150
export const HOME_BOOT_SPLASH_FADE_MS = 220
export const HOME_FIRST_SCREEN_LIST_LIMIT = 3

export const homeBootDeadline = (launchStartedAt: number, preloadStartedAt: number) => {
  const naturalEnd = launchStartedAt + HOME_LAUNCH_HOLD_MS
  return Math.min(
    naturalEnd + HOME_BOOT_EXTRA_WAIT_MS,
    preloadStartedAt + HOME_BOOT_PRELOAD_BUDGET_MS,
  )
}

export const homeBootRevealAt = (input: {
  launchStartedAt: number
  preloadStartedAt: number
  readyAt: number | null
}) => {
  const naturalEnd = input.launchStartedAt + HOME_LAUNCH_HOLD_MS
  const deadline = homeBootDeadline(input.launchStartedAt, input.preloadStartedAt)
  const cap = Math.max(naturalEnd, deadline)
  if (input.readyAt == null) return cap
  return Math.max(naturalEnd, Math.min(input.readyAt, cap))
}

export const homeBootExtraWaitMs = (input: {
  launchStartedAt: number
  preloadStartedAt: number
  readyAt: number | null
}) => {
  return homeBootRevealAt(input) - (input.launchStartedAt + HOME_LAUNCH_HOLD_MS)
}

export const homeBootIsReady = (input: { countsReady: boolean, coversReady: boolean }) => {
  return input.countsReady && input.coversReady
}

/** A cache miss still fades in under the splash. A hit does not add that delay. */
export const homeCoverSettleAt = (prefetchFinishedAt: number, hadCacheMiss: boolean) => {
  if (!hadCacheMiss) return prefetchFinishedAt
  return prefetchFinishedAt + HOME_BOOT_COVER_FADE_MS
}

export interface HomeListRef {
  id: string
}

/** Same order as the home hero cards and the daily-playlist block: love, default, then custom. */
export const selectHomeFirstListIds = (
  lists: readonly HomeListRef[],
  ids: { love: string, fallback: string } = { love: LOVE_LIST_ID, fallback: DEFAULT_LIST_ID },
) => {
  const love = lists.find(list => list.id == ids.love)
  const fallback = lists.find(list => list.id == ids.fallback)
  const custom = lists.filter(list => list.id != ids.love && list.id != ids.fallback)
  const ordered = [love, fallback, ...custom].filter((list): list is HomeListRef => Boolean(list))
  const seen = new Set<string>()
  const selected: string[] = []
  for (const list of ordered) {
    if (seen.has(list.id)) continue
    seen.add(list.id)
    selected.push(list.id)
    if (selected.length >= HOME_FIRST_SCREEN_LIST_LIMIT) break
  }
  return selected
}

export interface HomeCoverSong {
  source: string
  id: string
  picUrl?: string | null
  togglePicUrl?: string | null
  albumId?: string | number | null
}

export interface HomeCoverLookup {
  mapped: (song: HomeCoverSong) => { url: string, thumbUrl: string } | null
  isCached: (url: string) => boolean
}

/** First song cover the home card will paint. Cached files win so the first frame can skip the placeholder. */
export const resolveHomeListCover = (
  songs: readonly HomeCoverSong[],
  lookup: HomeCoverLookup,
): string | null => {
  for (const song of songs) {
    if (!song?.id) continue
    if (song.source == 'local') {
      let local = song.picUrl?.trim()
      if (!local) local = song.togglePicUrl?.trim()
      if (local) return local
      continue
    }
    const url = resolvePlaylistRowCover({
      source: song.source,
      picUrl: song.picUrl,
      togglePicUrl: song.togglePicUrl,
      mapped: lookup.mapped(song),
      isCached: lookup.isCached,
    })
    if (url) return url
  }
  return null
}

export const collectHomeWarmUrls = (covers: ReadonlyArray<string | null | undefined>) => {
  const urls: string[] = []
  for (const cover of covers) {
    if (!cover) continue
    const trimmed = cover.trim()
    if (!trimmed || urls.includes(trimmed)) continue
    urls.push(trimmed)
  }
  return urls
}

/** Unknown counts stay blank. A real zero still reads as zero songs. */
export const formatHomeDailyMeta = (tag: string, count: number | null, tracksLabel: string) => {
  if (count == null) return tag
  return `${tag} · ${tracksLabel}`
}
