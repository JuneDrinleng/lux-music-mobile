/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { onDataSpaceChanged, onDataSpaceWillChange } from '@/utils/dataSpace'
import playerState from '@/store/player/state'
import BackgroundTimer from 'react-native-background-timer'
import { getPosition } from '@/plugins/player'

import { createListenSession, sampleListenSession, type ListenSession } from './session'
import { getPlayDeviceId, upsertPlayRecord } from './store'
import { intervalToMs, isCompletedPlay, qualifiesAsPlay } from './threshold'
import { type PlayHistorySong, type PlayRecord } from './types'

let session: ListenSession | null = null
let song: PlayHistorySong | null = null
let durationMs: number | null = null
let syncedThisSession = false
let timer: number | null = null
let completedNaturally = false
let skipped = false
let generation = 0
let lastStartedAt = 0
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
  if (Number.isFinite(fromPlayer) && fromPlayer > 0) return Math.round(fromPlayer * 1000)
  return intervalToMs(music?.interval)
}

const positionMs = (): number => Math.max(0, Math.round((playerState.progress.nowPlayTime || 0) * 1000))

const clearTimer = () => {
  if (!timer) return
  BackgroundTimer.clearInterval(timer)
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
    completed: completedNaturally || isCompletedPlay(session.listenedMs, durationMs),
    skipped,
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

const sample = (playing: boolean, position = Math.max(positionMs(), session?.lastPositionMs ?? 0)) => {
  if (!session) return
  const music = readMusic()
  if (music) durationMs = readDurationMs(music)
  session = sampleListenSession(session, Date.now(), position, playing)
  publish('progress')
}

const captureTail = () => {
  if (session?.playing) sample(true)
}

export const finishPlayHistorySession = (reason: 'switch' | 'end' | 'stop' | 'interrupted' = 'switch') => {
  captureTail()
  completedNaturally = reason == 'end'
  skipped = reason == 'switch' && !!session && !isCompletedPlay(session.listenedMs, durationMs)
  publish('final')
  generation++
  session = null
  song = null
  durationMs = null
  syncedThisSession = false
  clearTimer()
}

const ensureSession = () => {
  const music = readMusic()
  if (!music) {
    if (session) finishPlayHistorySession('stop')
    return
  }
  const nextSong = songFromMusic(music)
  const same = song && song.source == nextSong.source && song.songmid == nextSong.songmid && session
  if (same) {
    song = nextSong
    durationMs = readDurationMs(music)
    return
  }
  if (session) finishPlayHistorySession()
  song = nextSong
  durationMs = readDurationMs(music)
  completedNaturally = false
  skipped = false
  lastStartedAt = Math.max(Date.now(), lastStartedAt + 1)
  session = createListenSession(lastStartedAt)
  syncedThisSession = false
}

const startTimer = () => {
  if (timer) return
  timer = BackgroundTimer.setInterval(() => {
    // UI progress polling stops with the screen off. Read native audio progress instead.
    const current = session
    const version = generation
    void getPosition().then(position => {
      if (session !== current || generation != version || !session?.playing) return
      sample(true, Math.max(0, Math.round(position * 1000)))
    }).catch(() => {})
  }, 1000)
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
  finishPlayHistorySession('stop')
}

const handleMusicToggled = () => {
  // The normal switch boundary runs before progress is reset in setPlayMusicInfo.
  ensureSession()
  if (playerState.isPlay) handlePlay()
}

const handleSeek = (position: number) => {
  if (!session) return
  generation++
  // Explicit scrubs must be dropped even when the jump resembles normal playback.
  session = { ...session, lastAt: Date.now(), lastPositionMs: Math.max(0, Math.round(position * 1000)) }
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

// Do not carry a listening session from one account into another account's history.
onDataSpaceWillChange(() => {
  generation++
  session = null
  song = null
  durationMs = null
  syncedThisSession = false
  clearTimer()
})
onDataSpaceChanged(() => {
  if (started && playerState.isPlay) handlePlay()
})
