/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import playerState from '@/store/player/state'

import { createListenSession, sampleListenSession, type ListenSession } from './session'
import { getPlayDeviceId, upsertPlayRecord } from './store'
import { intervalToMs, qualifiesAsPlay } from './threshold'
import { type PlayHistorySong, type PlayRecord } from './types'

let session: ListenSession | null = null
let song: PlayHistorySong | null = null
let durationMs: number | null = null
let syncedThisSession = false
let timer: ReturnType<typeof setInterval> | null = null
let started = false
let onQualified: ((record: PlayRecord, reason: 'progress' | 'final') => void) | null = null

const readMusic = (): LX.Music.MusicInfo | null => {
  const info = playerState.playMusicInfo.musicInfo
  if (!info) return null
  if ('progress' in info && info.metadata?.musicInfo) return info.metadata.musicInfo
  if ('source' in info && 'name' in info) return info
  return null
}

const songFromMusic = (music: LX.Music.MusicInfo): PlayHistorySong => {
  const pic = music.meta?.picUrl
  return {
    source: music.source,
    songmid: String(music.meta?.songId ?? music.id),
    name: music.name ?? '',
    singer: music.singer ?? '',
    albumName: music.meta?.albumName ? music.meta.albumName : undefined,
    interval: music.interval ? music.interval : undefined,
    img: typeof pic == 'string' && pic ? pic : undefined,
  }
}

const readDurationMs = (music: LX.Music.MusicInfo | null): number | null => {
  const fromPlayer = playerState.progress.maxPlayTime
  if (fromPlayer > 1) return Math.round(fromPlayer * 1000)
  return intervalToMs(music?.interval)
}

const positionMs = (): number => Math.max(0, Math.round((playerState.progress.nowPlayTime || 0) * 1000))

const clearTimer = () => {
  if (!timer) return
  clearInterval(timer)
  timer = null
}

const buildRecord = (): PlayRecord | null => {
  if (!session || !song) return null
  if (!qualifiesAsPlay(session.listenedMs, durationMs)) return null
  return {
    id: `${getPlayDeviceId()}:${session.startedAt}`,
    deviceId: getPlayDeviceId(),
    startedAt: session.startedAt,
    endedAt: Date.now(),
    listenedMs: Math.round(session.listenedMs),
    song,
  }
}

const publish = (reason: 'progress' | 'final') => {
  const record = buildRecord()
  if (!record) return
  upsertPlayRecord(record)
  if (reason == 'final' || !syncedThisSession) {
    syncedThisSession = true
    onQualified?.(record, reason)
  }
}

const sample = (playing: boolean) => {
  if (!session) return
  const music = readMusic()
  if (music) durationMs = readDurationMs(music)
  session = sampleListenSession(session, Date.now(), positionMs(), playing)
  publish('progress')
}

const captureTail = () => {
  if (session?.playing) sample(true)
}

const finishSession = () => {
  captureTail()
  publish('final')
  session = null
  song = null
  durationMs = null
  syncedThisSession = false
  clearTimer()
}

const ensureSession = () => {
  const music = readMusic()
  if (!music) {
    if (session) finishSession()
    return
  }
  const nextSong = songFromMusic(music)
  const same = song && song.source == nextSong.source && song.songmid == nextSong.songmid && session
  if (same) {
    song = nextSong
    durationMs = readDurationMs(music)
    return
  }
  if (session) finishSession()
  song = nextSong
  durationMs = readDurationMs(music)
  session = createListenSession(Date.now())
  syncedThisSession = false
}

const startTimer = () => {
  if (timer) return
  timer = setInterval(() => { sample(true) }, 1000)
}

const handlePlay = () => {
  ensureSession()
  sample(true)
  startTimer()
}

const handlePause = () => {
  captureTail()
  if (session) session = { ...session, playing: false }
  clearTimer()
}

const handleStop = () => {
  finishSession()
}

const handleMusicToggled = () => {
  finishSession()
  ensureSession()
  if (playerState.isPlay) handlePlay()
}

const handleSeek = () => {
  if (!session) return
  sample(session.playing && !!playerState.isPlay)
}

/** Id of the session still in progress. A bulk sync should not upload it until it ends. */
export const getOpenPlaySessionId = (): string | null => {
  if (!session) return null
  const deviceId = getPlayDeviceId()
  if (!deviceId) return null
  return `${deviceId}:${session.startedAt}`
}

export const startPlayHistoryTracker = (syncQualified?: (record: PlayRecord, reason: 'progress' | 'final') => void) => {
  if (started) return
  started = true
  onQualified = syncQualified ?? null
  global.app_event.on('play', handlePlay)
  global.app_event.on('pause', handlePause)
  global.app_event.on('stop', handleStop)
  global.app_event.on('error', handlePause)
  global.app_event.on('musicToggled', handleMusicToggled)
  global.app_event.on('setProgress', handleSeek)
  if (playerState.isPlay) handlePlay()
}
