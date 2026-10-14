/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { getPosition } from '@/plugins/player'
import playerState from '@/store/player/state'
import togetherState from '@/store/together/state'
import { findLuxAuthForHost, getSyncHost, getUserName } from '@/utils/data'

import { getClockDebugSnapshot, getServerNow } from './clock'
import { getTogetherDebugPanelEnabled } from './debugPanelPreference'
import { formatTogetherGateHint, snapshotTogetherGate } from './togetherGate'
import { expectedPositionMs, isSameSong } from './math'

export interface TogetherDebugEvent {
  at: number
  kind: string
  detail: string
  recvLatencyMs?: number
}

const MAX_EVENTS = 10

let events: TogetherDebugEvent[] = []
let wired = false
let lastPushSongKey: string | null = null

export const resetTogetherDebugPushSong = () => {
  lastPushSongKey = null
}

const listeners = new Set<() => void>()

const notify = () => {
  for (const listener of listeners) listener()
}

export const subscribeTogetherDebugTelemetry = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export const getTogetherDebugEvents = (): readonly TogetherDebugEvent[] => events

export const clearTogetherDebugEvents = () => {
  events = []
  notify()
}

export const recordTogetherDebugEvent = (
  kind: string,
  detail: string,
  recvLatencyMs?: number,
) => {
  if (!getTogetherDebugPanelEnabled()) return
  const row: TogetherDebugEvent = {
    at: Date.now(),
    kind,
    detail,
    ...(recvLatencyMs != null && Number.isFinite(recvLatencyMs) ? { recvLatencyMs: Math.round(recvLatencyMs) } : {}),
  }
  events = [...events, row].slice(-MAX_EVENTS)
  notify()
}

export const recordTogetherRoomStatePush = (push: LX.Sync.Together.RoomStatePush) => {
  if (!getTogetherDebugPanelEnabled()) return
  const recvLatencyMs = getServerNow() - push.serverTime
  const playback = push.playback
  const song = playback.musicInfo
  const songKey = song ? `${song.source}:${song.id}` : null
  const parts: string[] = [
    playback.isPlaying ? 'play' : 'pause',
    `pos=${Math.round(playback.positionMs)}`,
    `v=${push.playbackVersion}`,
  ]
  if (songKey && songKey != lastPushSongKey) {
    lastPushSongKey = songKey
    recordTogetherDebugEvent('track', song?.name ?? songKey, recvLatencyMs)
    return
  }
  recordTogetherDebugEvent('push', parts.join(' '), recvLatencyMs)
}

const onPlay = () => { recordTogetherDebugEvent('play', 'local play') }
const onPause = () => { recordTogetherDebugEvent('pause', 'local pause') }
const onSeek = (time: number) => {
  if (!Number.isFinite(time)) return
  recordTogetherDebugEvent('seek', `t=${Math.round(time * 1000)}ms`)
}
const onTrack = () => {
  const music = playerState.playMusicInfo.musicInfo
  if (!music) return
  const raw = 'progress' in music ? music.metadata.musicInfo : music
  recordTogetherDebugEvent('track', `${raw.name} (${raw.source})`)
}

const wireAppEvents = () => {
  if (wired) return
  wired = true
  global.app_event.on('play', onPlay)
  global.app_event.on('pause', onPause)
  global.app_event.on('setProgress', onSeek)
  global.app_event.on('musicToggled', onTrack)
}

const unwireAppEvents = () => {
  if (!wired) return
  wired = false
  global.app_event.off('play', onPlay)
  global.app_event.off('pause', onPause)
  global.app_event.off('setProgress', onSeek)
  global.app_event.off('musicToggled', onTrack)
}

export const syncTogetherDebugTelemetry = (enabled: boolean) => {
  if (enabled) wireAppEvents()
  else {
    unwireAppEvents()
    clearTogetherDebugEvents()
    lastPushSongKey = null
  }
}

export const readLocalPositionMs = async(): Promise<number> => {
  const position = await getPosition().catch(() => playerState.progress.nowPlayTime)
  const sec = Number.isFinite(position) ? position : playerState.progress.nowPlayTime
  return Math.max(0, sec * 1000)
}

export interface TogetherDebugLiveMetrics {
  hostPositionMs: number | null
  myPositionMs: number | null
  driftMs: number | null
  clockOffsetMs: number
  rttMs: number | null
  roomId: string | null
  role: string | null
}

export const computeTogetherDebugLiveMetrics = async(): Promise<TogetherDebugLiveMetrics> => {
  const clock = getClockDebugSnapshot()
  const room = togetherState.room
  const myPositionMs = room ? Math.round(await readLocalPositionMs()) : null
  let hostPositionMs: number | null = null
  let driftMs: number | null = null
  if (room?.playback) {
    hostPositionMs = Math.round(expectedPositionMs(room.playback, getServerNow()))
    if (myPositionMs != null) driftMs = myPositionMs - hostPositionMs
  }
  return {
    hostPositionMs,
    myPositionMs,
    driftMs,
    clockOffsetMs: clock.offsetMs,
    rttMs: clock.rttMs,
    roomId: room?.roomId ?? null,
    role: togetherState.role,
  }
}

export const buildTogetherDiagnosticText = async(): Promise<string> => {
  const metrics = await computeTogetherDebugLiveMetrics()
  const gate = await snapshotTogetherGate()
  const room = togetherState.room
  const host = (await getSyncHost()).trim()
  const auth = host ? await findLuxAuthForHost(host) : null
  const account = auth?.username ?? (await getUserName())
  const lines: string[] = [
    `app=${process.versions.app}`,
    `server=${host || '(none)'}`,
    `account=${account}`,
    `connection=${togetherState.connection}`,
    formatTogetherGateHint(gate),
    `roomId=${metrics.roomId ?? '(none)'}`,
    `role=${metrics.role ?? '(none)'}`,
    `invite=${room?.code ?? '(none)'}`,
    `clockOffsetMs=${metrics.clockOffsetMs}`,
    `rttMs=${metrics.rttMs ?? '(none)'}`,
    `hostPositionMs=${metrics.hostPositionMs ?? '(none)'}`,
    `myPositionMs=${metrics.myPositionMs ?? '(none)'}`,
    `driftMs=${metrics.driftMs ?? '(none)'}`,
    `playbackVersion=${room?.playbackVersion ?? '(none)'}`,
    `roomVersion=${room?.version ?? '(none)'}`,
    '',
    'events:',
  ]
  for (const event of events) {
    const latency = event.recvLatencyMs != null ? ` latency=${event.recvLatencyMs}ms` : ''
    lines.push(`- [${new Date(event.at).toISOString()}] ${event.kind} ${event.detail}${latency}`)
  }
  if (!events.length) lines.push('- (none)')
  if (room?.playback.musicInfo) {
    const song = room.playback.musicInfo
    lines.push('', `now=${song.name} (${song.source}:${song.id})`)
    const local = currentSongKey()
    if (local && !isSameSong(local, song)) lines.push(`localMismatch=${local.source}:${local.id}`)
  }
  return lines.join('\n')
}

const currentSongKey = (): { id: string, source: string } | null => {
  const musicInfo = playerState.playMusicInfo.musicInfo
  if (!musicInfo) return null
  return 'progress' in musicInfo ? musicInfo.metadata.musicInfo : musicInfo
}
