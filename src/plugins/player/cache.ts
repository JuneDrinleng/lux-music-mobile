/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { getPlayQuality } from '@/core/music/utils'
import settingState from '@/store/setting/state'


const getRawMusicInfo = (musicInfo: LX.Player.PlayMusic) => {
  return 'progress' in musicInfo ? musicInfo.metadata.musicInfo : musicInfo
}

const getMusicCacheQuality = (musicInfo: LX.Player.PlayMusic) => {
  if ('progress' in musicInfo) return musicInfo.metadata.quality

  const rawMusicInfo = getRawMusicInfo(musicInfo)
  if (rawMusicInfo.source == 'local') return 'local'

  return getPlayQuality(settingState.setting['player.playQuality'], rawMusicInfo)
}

export const getTrackCacheKey = (musicInfo: LX.Player.PlayMusic) => {
  const rawMusicInfo = getRawMusicInfo(musicInfo)
  return `${rawMusicInfo.source}_${rawMusicInfo.id}_${getMusicCacheQuality(musicInfo)}`
}
