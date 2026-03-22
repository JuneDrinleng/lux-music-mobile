import { addPlayedList, clearPlayedList } from '@/core/player/playedList'
import { pause, playNext } from '@/core/player/player'
import { setStatusText, setIsPlay } from '@/core/player/playStatus'
// import { resetPlayerMusicInfo } from '@/core/player/playInfo'
import { isInitialized, setPlaybackRate, setStop, setVolume } from '@/plugins/player'
import { delayUpdateMusicInfo } from '@/plugins/player/playList'
import playerState from '@/store/player/state'
import settingState from '@/store/setting/state'
import { AppState } from 'react-native'


export default async(setting: LX.AppSetting) => {
  const normalizeVolume = (value: number) => {
    const volume = Number(value)
    if (!Number.isFinite(volume)) return 1
    if (volume < 0) return 0
    if (volume > 1) return 1
    return volume
  }
  const normalizePlayRate = (value: number) => {
    const playRate = Number(value)
    if (!Number.isFinite(playRate)) return 1
    if (playRate < 0.25) return 0.25
    if (playRate > 4) return 4
    return playRate
  }
  const applyPlayerOutputSetting = () => {
    if (!isInitialized()) return
    const volume = normalizeVolume(settingState.setting['player.volume'])
    const playRate = normalizePlayRate(settingState.setting['player.playbackRate'])
    void setVolume(volume).catch(err => {
      console.log('setVolume failed', err)
    })
    void setPlaybackRate(playRate).catch(err => {
      console.log('setPlaybackRate failed', err)
    })
  }

  const setPlayStatus = () => {
    setIsPlay(true)
  }
  const setPauseStatus = () => {
    setIsPlay(false)
    if (global.lx.isPlayedStop) void pause()
  }

  const handleEnded = () => {
    // setTimeout(() => {
    if (global.lx.isPlayedStop) {
      setStatusText(global.i18n.t('player__end'))
      return
    }
    // resetPlayerMusicInfo()
    // global.app_event.stop()
    global.app_event.setProgress(0)
    setStatusText(global.i18n.t('player__end'))
    void playNext(true)
    // })
  }

  const setStopStatus = () => {
    setIsPlay(false)
    setStatusText('')
    void setStop()
  }

  const updatePic = () => {
    if (!settingState.setting['player.isShowNotificationImage']) return
    if (playerState.playMusicInfo.musicInfo && playerState.musicInfo.pic) {
      delayUpdateMusicInfo(playerState.musicInfo, playerState.lastLyric)
    }
  }

  const handleConfigUpdated: typeof global.state_event.configUpdated = (keys, settings) => {
    if (keys.includes('player.togglePlayMethod')) {
      const newValue = settings['player.togglePlayMethod']
      if (playerState.playedList.length) clearPlayedList()
      const playMusicInfo = playerState.playMusicInfo
      if (newValue == 'random' && playMusicInfo.musicInfo && !playMusicInfo.isTempPlay) addPlayedList({ ...(playMusicInfo as LX.Player.PlayMusicInfo) })
    }
    if (keys.includes('player.volume') || keys.includes('player.playbackRate')) {
      applyPlayerOutputSetting()
    }
  }


  global.app_event.on('play', setPlayStatus)
  global.app_event.on('pause', setPauseStatus)
  global.app_event.on('error', setPauseStatus)
  global.app_event.on('stop', setStopStatus)
  global.app_event.on('playerEnded', handleEnded)
  global.app_event.on('picUpdated', updatePic)
  global.state_event.on('configUpdated', handleConfigUpdated)
  AppState.addEventListener('change', (state) => {
    if (state == 'active') applyPlayerOutputSetting()
  })
}
