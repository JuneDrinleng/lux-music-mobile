/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import BackgroundTimer from 'react-native-background-timer'

import { getList } from '@/core/player/playInfo'
import { getPlayQuality } from '@/core/music/utils'
import { getPosition } from '@/plugins/player'
import { callTogether } from '@/plugins/sync/client/modules/together/api'
import playerState from '@/store/player/state'
import settingState from '@/store/setting/state'
import togetherState from '@/store/together/state'
import { log } from '@/utils/log'

import { getServerNow } from './clock'
import {
  HOST_HEARTBEAT_MS,
  HOST_MIN_INTERVAL_MS,
  HOST_QUEUE_THROTTLE_MS,
  queueSignature,
  windowQueue,
} from './math'

export interface HostCallbacks {
  /** Server answered NOT_HOST: stop reporting and resync. */
  onLostHost: () => void
  /** An ack advanced the room version; returns nothing. */
  onAck: (ack: LX.Sync.Together.UpdateAck, kind: 'playback' | 'queue') => void
}

let active = false
let callbacks: HostCallbacks | null = null
let heartbeatId: number | null = null
let stateTimer: number | null = null
let queueTimer: number | null = null
let stateInFlight = false
let stateDirty = false
let lastStateSentAt = 0
let queueInFlight = false
let queueDirty = false
let lastQueueSignature: string | null = null
let pendingSeek: { positionMs: number, at: number } | null = null

const toOnlineMusic = (musicInfo: LX.Player.PlayMusic | null | undefined): LX.Music.MusicInfoOnline | null => {
  if (!musicInfo) return null
  const raw = 'progress' in musicInfo ? musicInfo.metadata.musicInfo : musicInfo
  if (raw.source == 'local') return null
  const meta = { ...raw.meta } as LX.Music.MusicInfoOnline['meta'] & { toggleMusicInfo?: unknown }
  delete meta.toggleMusicInfo
  return { ...raw, meta } as LX.Music.MusicInfoOnline
}

const buildStateRequest = async(): Promise<Omit<LX.Sync.Together.HostUpdateStateRequest, 'roomId' | 'baseVersion'>> => {
  const musicInfo = toOnlineMusic(playerState.playMusicInfo.musicInfo)
  if (!musicInfo) {
    return { musicInfo: null, quality: null, isPlaying: false, positionMs: 0, durationMs: 0, sampledAt: getServerNow() }
  }
  const isPlaying = playerState.isPlay
  let positionMs: number
  const seek = pendingSeek
  if (seek && Date.now() - seek.at < 1500) {
    positionMs = seek.positionMs + (isPlaying ? Date.now() - seek.at : 0)
  } else {
    const position = await getPosition().catch(() => playerState.progress.nowPlayTime)
    positionMs = Math.max(0, (Number.isFinite(position) ? position : playerState.progress.nowPlayTime) * 1000)
  }
  const sampledAt = getServerNow()
  const durationMs = Math.max(0, Math.round(playerState.progress.maxPlayTime * 1000))
  return {
    musicInfo,
    quality: getPlayQuality(settingState.setting['player.playQuality'], musicInfo),
    isPlaying,
    positionMs: Math.round(positionMs),
    durationMs,
    sampledAt,
  }
}

const buildQueueRequest = (): { items: LX.Music.MusicInfoOnline[], currentId: string | null } => {
  const current = toOnlineMusic(playerState.playMusicInfo.musicInfo)
  const listId = playerState.playInfo.playerListId
  const list = listId ? getList(listId) : []
  const online: LX.Music.MusicInfoOnline[] = []
  let currentIndex = -1
  for (const item of list as LX.Player.PlayMusic[]) {
    const music = toOnlineMusic(item)
    if (!music) continue
    if (current && currentIndex < 0 && music.id == current.id && music.source == current.source) currentIndex = online.length
    online.push(music)
  }
  return { items: windowQueue(online, Math.max(0, currentIndex)), currentId: current?.id ?? null }
}

const sendState = async() => {
  if (!active || stateInFlight) {
    stateDirty = true
    return
  }
  const room = togetherState.room
  if (!room) return
  stateInFlight = true
  stateDirty = false
  lastStateSentAt = Date.now()
  try {
    const body = await buildStateRequest()
    let request: LX.Sync.Together.HostUpdateStateRequest = { ...body, roomId: room.roomId, baseVersion: togetherState.room?.playbackVersion ?? room.playbackVersion }
    let result = await callTogether('together:hostUpdateState', request)
    if (!result.ok && result.code == 'VERSION_CONFLICT') {
      const detail = result.detail as LX.Sync.Together.RoomSnapshot | undefined
      if (detail && typeof detail.playbackVersion == 'number') {
        request = { ...request, baseVersion: detail.playbackVersion }
        result = await callTogether('together:hostUpdateState', request)
      }
    }
    if (!active) return
    if (result.ok) {
      callbacks?.onAck(result.data, 'playback')
    } else if (result.code == 'NOT_HOST' || result.code == 'NOT_IN_ROOM') {
      callbacks?.onLostHost()
    } else if (result.code == 'RATE_LIMITED') {
      stateDirty = true
    } else {
      log.warn('together hostUpdateState failed:', result.code, result.message)
    }
  } catch (error) {
    log.warn('together hostUpdateState error:', error instanceof Error ? error.message : error)
  } finally {
    stateInFlight = false
    if (active && stateDirty) scheduleState()
  }
}

/** Coalesce events in the same tick; at most 4 sends per second. */
const scheduleState = () => {
  if (!active || stateTimer != null) return
  const wait = Math.max(0, lastStateSentAt + HOST_MIN_INTERVAL_MS - Date.now())
  stateTimer = BackgroundTimer.setTimeout(() => {
    stateTimer = null
    void sendState()
  }, wait)
}

const sendQueue = async(force = false) => {
  if (!active) return
  if (queueInFlight) {
    queueDirty = true
    return
  }
  const room = togetherState.room
  if (!room) return
  const { items, currentId } = buildQueueRequest()
  const signature = queueSignature(items, currentId)
  if (!force && signature == lastQueueSignature) return
  queueInFlight = true
  queueDirty = false
  try {
    let request: LX.Sync.Together.HostUpdateQueueRequest = { roomId: room.roomId, baseVersion: togetherState.room?.queueVersion ?? room.queueVersion, items, currentId }
    let result = await callTogether('together:hostUpdateQueue', request)
    if (!result.ok && result.code == 'VERSION_CONFLICT') {
      const detail = result.detail as LX.Sync.Together.RoomSnapshot | undefined
      if (detail && typeof detail.queueVersion == 'number') {
        request = { ...request, baseVersion: detail.queueVersion }
        result = await callTogether('together:hostUpdateQueue', request)
      }
    }
    if (!active) return
    if (result.ok) {
      lastQueueSignature = signature
      callbacks?.onAck(result.data, 'queue')
    } else if (result.code == 'NOT_HOST' || result.code == 'NOT_IN_ROOM') {
      callbacks?.onLostHost()
    } else if (result.code == 'RATE_LIMITED') {
      queueDirty = true
    } else {
      log.warn('together hostUpdateQueue failed:', result.code, result.message)
    }
  } catch (error) {
    log.warn('together hostUpdateQueue error:', error instanceof Error ? error.message : error)
  } finally {
    queueInFlight = false
    if (active && queueDirty) scheduleQueue()
  }
}

const scheduleQueue = () => {
  if (!active || queueTimer != null) return
  queueTimer = BackgroundTimer.setTimeout(() => {
    queueTimer = null
    void sendQueue()
  }, HOST_QUEUE_THROTTLE_MS)
}

const handleImmediate = () => { scheduleState() }
const handleSeek = (time: number) => {
  if (Number.isFinite(time)) pendingSeek = { positionMs: Math.max(0, time * 1000), at: Date.now() }
  scheduleState()
}
const handleMusicToggled = () => {
  pendingSeek = null
  scheduleState()
  scheduleQueue()
}
const handleListChange = (listIds: string[]) => {
  const listId = playerState.playInfo.playerListId
  if (listId && listIds.includes(listId)) scheduleQueue()
}

const startHeartbeat = () => {
  if (heartbeatId != null) return
  heartbeatId = BackgroundTimer.setInterval(() => {
    if (!active) return
    if (playerState.isPlay) scheduleState()
    scheduleQueue()
  }, HOST_HEARTBEAT_MS)
}

export const isHostReporting = () => active

/** Start reporting this device's player as the room state. Pushes state and queue immediately. */
export const startHostReporting = (cb: HostCallbacks) => {
  callbacks = cb
  if (!active) {
    active = true
    global.app_event.on('play', handleImmediate)
    global.app_event.on('pause', handleImmediate)
    global.app_event.on('stop', handleImmediate)
    global.app_event.on('setProgress', handleSeek)
    global.app_event.on('musicToggled', handleMusicToggled)
    global.app_event.on('myListMusicUpdate', handleListChange)
    startHeartbeat()
  }
  lastQueueSignature = null
  scheduleState()
  void sendQueue(true)
}

export const stopHostReporting = () => {
  if (!active) return
  active = false
  global.app_event.off('play', handleImmediate)
  global.app_event.off('pause', handleImmediate)
  global.app_event.off('stop', handleImmediate)
  global.app_event.off('setProgress', handleSeek)
  global.app_event.off('musicToggled', handleMusicToggled)
  global.app_event.off('myListMusicUpdate', handleListChange)
  if (heartbeatId != null) BackgroundTimer.clearInterval(heartbeatId)
  if (stateTimer != null) BackgroundTimer.clearTimeout(stateTimer)
  if (queueTimer != null) BackgroundTimer.clearTimeout(queueTimer)
  heartbeatId = null
  stateTimer = null
  queueTimer = null
  stateDirty = false
  queueDirty = false
  pendingSeek = null
  lastQueueSignature = null
}
