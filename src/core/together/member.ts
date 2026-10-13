/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import BackgroundTimer from 'react-native-background-timer'

import { LIST_IDS } from '@/config/constant'
import { getListMusics, setTempList } from '@/core/list'
import { isPlayQueueMetaId, pause, play, playList } from '@/core/player/player'
import { setStatusText } from '@/core/player/playStatus'
import { setNowPlayTime } from '@/core/player/progress'
import { getPosition, setCurrentTime } from '@/plugins/player'
import listState from '@/store/list/state'
import playerState from '@/store/player/state'
import togetherState from '@/store/together/state'
import { log } from '@/utils/log'

import { getServerNow } from './clock'
import { runAsTogetherApply, setTogetherBlockedHandler } from './control'
import {
  DRIFT_CHECK_MS,
  expectedPositionMs,
  isSameSong,
  queueSignature,
  seekTargetSeconds,
  shouldCorrectDrift,
} from './math'

/** Prefixed with play_queue__ so the queue sheet treats the room queue like any play queue. */
const QUEUE_META_PREFIX = 'play_queue__together_'

let active = false
let driftId: number | null = null
let lastSeekAt = 0
let loadingSong: { id: string, source: string, at: number } | null = null
let appliedQueueSignature: string | null = null
let applyToken = 0

/** A load that never reached `play` (URL failure) stops blocking after this long. */
const LOAD_STALE_MS = 20_000
const isLoading = () => loadingSong != null && Date.now() - loadingSong.at < LOAD_STALE_MS

const currentSong = (): { id: string, source: string } | null => {
  const musicInfo = playerState.playMusicInfo.musicInfo
  if (!musicInfo) return null
  return 'progress' in musicInfo ? musicInfo.metadata.musicInfo : musicInfo
}

const isRoomQueueActive = () => {
  const room = togetherState.room
  return room != null &&
    playerState.playInfo.playerListId == LIST_IDS.TEMP &&
    isPlayQueueMetaId(listState.tempListMeta.id) &&
    listState.tempListMeta.id.startsWith(`${QUEUE_META_PREFIX}${room.roomId}`)
}

const queueFor = (room: LX.Sync.Together.RoomSnapshot, song: LX.Music.MusicInfoOnline): LX.Music.MusicInfoOnline[] => {
  const items = room.queue.items
  return items.some(item => isSameSong(item, song)) ? items : [song]
}

const correctDrift = async(force = false) => {
  const room = togetherState.room
  if (!active || !room?.playback.musicInfo || isLoading()) return
  if (!playerState.isPlay && !force) return
  if (!isSameSong(currentSong(), room.playback.musicInfo)) return
  const position = await getPosition().catch(() => playerState.progress.nowPlayTime)
  const localMs = (Number.isFinite(position) ? position : playerState.progress.nowPlayTime) * 1000
  const expected = expectedPositionMs(room.playback, getServerNow())
  const now = Date.now()
  if (!shouldCorrectDrift(localMs, expected, force ? 0 : lastSeekAt, now)) return
  lastSeekAt = now
  const targetSec = seekTargetSeconds(expected)
  void runAsTogetherApply(async() => {
    setNowPlayTime(targetSec)
    await setCurrentTime(targetSec)
  })
}

const applyPlayState = (playback: LX.Sync.Together.Playback) => {
  if (playback.isPlaying) {
    if (!playerState.isPlay) play()
  } else if (playerState.isPlay) {
    void pause()
  }
}

const loadSong = async(room: LX.Sync.Together.RoomSnapshot, song: LX.Music.MusicInfoOnline) => {
  const token = ++applyToken
  loadingSong = { id: song.id, source: song.source, at: Date.now() }
  const list = queueFor(room, song)
  const index = Math.max(0, list.findIndex(item => isSameSong(item, song)))
  try {
    await runAsTogetherApply(async() => {
      await setTempList(`${QUEUE_META_PREFIX}${room.roomId}_${Date.now()}`, [...list])
      appliedQueueSignature = queueSignature(list, song.id)
      await playList(LIST_IDS.TEMP, index)
    })
  } catch (error) {
    if (token == applyToken) loadingSong = null
    log.warn('together load song failed:', error instanceof Error ? error.message : error)
  }
}

/** Called after the player reports `play` for a song we loaded on the host's behalf. */
const handlePlay = () => {
  if (!active || !loadingSong) return
  if (!isSameSong(currentSong(), loadingSong)) return
  loadingSong = null
  const room = togetherState.room
  if (!room) return
  if (!room.playback.isPlaying) void pause()
  void correctDrift(true)
}

/** Restore the room queue if a blocked play call replaced the temp list first. */
const restoreRoomQueue = () => {
  const room = togetherState.room
  const song = room?.playback.musicInfo
  if (!active || !room || !song) return
  // Callers may replace the temp list before the blocked play call; put the room queue back without reloading.
  BackgroundTimer.setTimeout(() => {
    if (!active || togetherState.room?.roomId != room.roomId || isRoomQueueActive()) return
    const list = queueFor(room, song)
    void runAsTogetherApply(async() => {
      await setTempList(`${QUEUE_META_PREFIX}${room.roomId}_${Date.now()}`, [...list])
    }).then(() => { appliedQueueSignature = queueSignature(list, song.id) })
  }, 0)
}

export const applyPlayback = async(room: LX.Sync.Together.RoomSnapshot, forceReload = false) => {
  if (!active) return
  const { musicInfo } = room.playback
  if (!musicInfo) {
    loadingSong = null
    setStatusText(global.i18n.t('together_host_local_music'))
    if (playerState.isPlay) void pause()
    return
  }
  const playingSong = currentSong()
  const needLoad = forceReload || !isSameSong(playingSong, musicInfo) || !isRoomQueueActive()
  if (needLoad) {
    if (isLoading() && isSameSong(loadingSong, musicInfo) && !forceReload) return
    await loadSong(room, musicInfo)
    return
  }
  if (isLoading()) return
  applyPlayState(room.playback)
  void correctDrift(true)
}

/** Replace the temp list contents with the room queue without restarting playback. */
export const applyQueue = async(room: LX.Sync.Together.RoomSnapshot) => {
  if (!active || isLoading() || !isRoomQueueActive()) return
  const song = room.playback.musicInfo
  if (!song) return
  const list = queueFor(room, song)
  const signature = queueSignature(list, song.id)
  if (signature == appliedQueueSignature) return
  const current = await getListMusics(LIST_IDS.TEMP)
  if (queueSignature(current, song.id) == signature) {
    // eslint-disable-next-line require-atomic-updates
    appliedQueueSignature = signature
    return
  }
  await runAsTogetherApply(async() => {
    await setTempList(listState.tempListMeta.id, [...list])
  })
  // eslint-disable-next-line require-atomic-updates
  appliedQueueSignature = signature
}

export const isMemberApplying = () => active

export const startMemberSync = () => {
  if (active) return
  active = true
  lastSeekAt = 0
  appliedQueueSignature = null
  global.app_event.on('play', handlePlay)
  setTogetherBlockedHandler(restoreRoomQueue)
  driftId = BackgroundTimer.setInterval(() => { void correctDrift() }, DRIFT_CHECK_MS)
}

export const stopMemberSync = () => {
  if (!active) return
  active = false
  applyToken += 1
  loadingSong = null
  appliedQueueSignature = null
  global.app_event.off('play', handlePlay)
  setTogetherBlockedHandler(null)
  if (driftId != null) BackgroundTimer.clearInterval(driftId)
  driftId = null
}
