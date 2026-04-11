/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

import TrackPlayer from 'react-native-track-player'
import { updateOptions, setVolume, setPlaybackRate, migratePlayerCache, isNotificationLikeSupported } from './utils'

// const listenEvent = () => {
//   TrackPlayer.addEventListener('playback-error', err => {
//     console.log('playback-error', err)
//   })
//   TrackPlayer.addEventListener('playback-state', info => {
//     console.log('playback-state', info)
//   })
//   TrackPlayer.addEventListener('playback-track-changed', info => {
//     console.log('playback-track-changed', info)
//   })
//   TrackPlayer.addEventListener('playback-queue-ended', info => {
//     console.log('playback-queue-ended', info)
//   })
// }

const initial = async({ volume, playRate, cacheSize, isHandleAudioFocus, isEnableAudioOffload }: {
  volume: number
  playRate: number
  cacheSize: number
  isHandleAudioFocus: boolean
  isEnableAudioOffload: boolean
}) => {
  const safeVolume = (() => {
    const value = Number(volume)
    if (!Number.isFinite(value)) return 1
    if (value < 0) return 0
    if (value > 1) return 1
    return value
  })()
  const safePlayRate = (() => {
    const value = Number(playRate)
    if (!Number.isFinite(value)) return 1
    if (value < 0.25) return 0.25
    if (value > 4) return 4
    return value
  })()

  if (global.lx.playerStatus.isIniting) return
  if (global.lx.playerStatus.isInitialized) {
    await updateOptions()
    await setVolume(safeVolume)
    await setPlaybackRate(safePlayRate)
    return
  }
  global.lx.playerStatus.isIniting = true
  console.log('Cache Size', cacheSize * 1024)
  await migratePlayerCache()
  await TrackPlayer.setupPlayer({
    maxCacheSize: cacheSize * 1024,
    maxBuffer: 1000,
    waitForBuffer: true,
    handleAudioFocus: isHandleAudioFocus,
    audioOffload: isEnableAudioOffload,
    autoUpdateMetadata: false,
  })
  global.lx.playerStatus.isInitialized = true
  global.lx.playerStatus.isIniting = false
  await updateOptions()
  await setVolume(safeVolume)
  await setPlaybackRate(safePlayRate)
  // listenEvent()
}


const isInitialized = () => global.lx.playerStatus.isInitialized


export {
  initial,
  isInitialized,
  setVolume,
  setPlaybackRate,
  updateOptions,
  isNotificationLikeSupported,
}

export {
  setResource,
  setPause,
  setPlay,
  setCurrentTime,
  getDuration,
  setStop,
  resetPlay,
  getPosition,
  updateMetaData,
  onStateChange,
  isEmpty,
  useBufferProgress,
  initTrackInfo,
} from './utils'
