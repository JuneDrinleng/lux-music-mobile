/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

// Lux Proprietary

import { storageDataPrefix } from '@/config/constant'
import { getTrackCacheKey } from '@/plugins/player/cache'
import { getData, saveData } from '@/plugins/storage'

export interface AudioCacheIndexEntry {
  key: string
  musicInfo: LX.Music.MusicInfo
}

let memory: AudioCacheIndexEntry[] | null = null
let loading: Promise<AudioCacheIndexEntry[]> | null = null
let writeTimer: ReturnType<typeof setTimeout> | null = null

const rawMusicInfo = (musicInfo: LX.Player.PlayMusic): LX.Music.MusicInfo => {
  return 'progress' in musicInfo ? musicInfo.metadata.musicInfo : musicInfo
}

const readAudioCacheIndex = async() => {
  try {
    const stored = await getData<AudioCacheIndexEntry[]>(storageDataPrefix.audioCacheIndex)
    const next = Array.isArray(stored)
      ? stored.filter(item => Boolean(item?.key && item.musicInfo?.id && item.musicInfo.source))
      : []
    memory = next
    return next
  } finally {
    loading = null
  }
}

export const loadAudioCacheIndex = async(): Promise<AudioCacheIndexEntry[]> => {
  if (memory) return memory
  loading ??= readAudioCacheIndex()
  return await loading
}

const scheduleWrite = () => {
  if (writeTimer) return
  writeTimer = setTimeout(() => {
    writeTimer = null
    if (memory) void saveData(storageDataPrefix.audioCacheIndex, memory)
  }, 400)
}

/** Remember which song a cache key belongs to. Called when a track is built for playback. */
export const rememberAudioCacheSong = async(musicInfo: LX.Player.PlayMusic) => {
  const raw = rawMusicInfo(musicInfo)
  if (!raw?.id || !raw.source) return
  const key = getTrackCacheKey(musicInfo)
  const list = await loadAudioCacheIndex()
  const next = list.filter(item => item.key != key)
  next.push({ key, musicInfo: raw })
  memory = next.slice(-2000)
  scheduleWrite()
}

export const forgetAudioCacheKeys = async(keys: readonly string[]) => {
  if (!keys.length) return
  const drop = new Set(keys)
  const list = await loadAudioCacheIndex()
  memory = list.filter(item => !drop.has(item.key))
  scheduleWrite()
}
