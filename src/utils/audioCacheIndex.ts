/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

// Lux Proprietary

import { storageDataPrefix } from '@/config/constant'
import { getTrackCacheKey } from '@/plugins/player/cache'
import { getData, saveData } from '@/plugins/storage'
import { createCachedSongIndex, type CachedSongIndexEntry } from '@/utils/cachedSongMetadata'

export type AudioCacheIndexEntry = CachedSongIndexEntry<LX.Music.MusicInfo>

let pendingWrite: AudioCacheIndexEntry[] | null = null
let writeTimer: ReturnType<typeof setTimeout> | null = null

const rawMusicInfo = (musicInfo: LX.Player.PlayMusic): LX.Music.MusicInfo => {
  return 'progress' in musicInfo ? musicInfo.metadata.musicInfo : musicInfo
}

const readAudioCacheIndex = async() => {
  const stored = await getData<AudioCacheIndexEntry[]>(storageDataPrefix.audioCacheIndex)
  return Array.isArray(stored)
    ? stored.filter(item => Boolean(item?.key && item.musicInfo?.id && item.musicInfo.source))
    : []
}

const scheduleWrite = (entries: AudioCacheIndexEntry[]) => {
  pendingWrite = entries
  if (writeTimer) return
  writeTimer = setTimeout(() => {
    writeTimer = null
    if (pendingWrite) void saveData(storageDataPrefix.audioCacheIndex, pendingWrite)
  }, 400)
}

const index = createCachedSongIndex(readAudioCacheIndex, scheduleWrite)

export const loadAudioCacheIndex = index.load

/** Remember which song a cache key belongs to. The key is the audio cache key, not a display name. */
export const rememberAudioCacheEntry = index.remember

/** Remember which song a cache key belongs to. Called when a track is built for playback. */
export const rememberAudioCacheSong = async(musicInfo: LX.Player.PlayMusic) => {
  const raw = rawMusicInfo(musicInfo)
  if (!raw?.id || !raw.source) return
  await rememberAudioCacheEntry(getTrackCacheKey(musicInfo), raw)
}

export const forgetAudioCacheKeys = index.forget
