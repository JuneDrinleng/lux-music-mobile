/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

import { initSetting, showPactModal } from '@/core/common'
import registerPlaybackService from '@/plugins/player/service'
import initTheme from './theme'
import initI18n from './i18n'
import initUserApi from './userApi'
import initPlayer from './player'
import dataInit from './dataInit'
import initSync from './sync'
import initCommonState from './common'
import { initDeeplink } from './deeplink'
import { setApiSource } from '@/core/apiSource'
import commonActions from '@/store/common/action'
import settingState from '@/store/setting/state'
import { checkUpdate, initVersionLifecycle } from '@/core/version'
import { bootLog } from '@/utils/bootLog'
import { cheatTip } from '@/utils/tools'
import { getFailedEntries, clearCoverFailure, recordCoverFailure, isCoverFailureStale } from '@/utils/coverFailureRegistry'
import { fetchAltCoverUrl } from '@/core/music/utils'
import { getListMusics, updateListMusics } from '@/core/list'
import listState from '@/store/list/state'
import BackgroundTimer from 'react-native-background-timer'

const retryStaleCoverFailures = async() => {
  const entries = await getFailedEntries()
  if (!entries.length) return

  const failedKeySet = new Set(entries.map(e => `${e.source}_${e.id}`))
  const allListIds = listState.allList.map(l => l.id)

  for (const listId of allListIds) {
    const songs = await getListMusics(listId)
    const toUpdate: Array<{ id: string, musicInfo: LX.Music.MusicInfo }> = []

    for (const song of songs) {
      if (song.source === 'local') continue
      const onlineSong = song as LX.Music.MusicInfoOnline
      const key = `${onlineSong.source}_${onlineSong.id}`
      if (!failedKeySet.has(key)) continue
      if (!await isCoverFailureStale(onlineSong)) continue

      const altUrl = await fetchAltCoverUrl(onlineSong)
      if (altUrl) {
        onlineSong.meta.picUrl = altUrl
        toUpdate.push({ id: listId, musicInfo: onlineSong })
        void clearCoverFailure(onlineSong)
      } else {
        void recordCoverFailure(onlineSong)
      }
    }

    if (toUpdate.length) void updateListMusics(toUpdate)
  }
}

let isFirstPush = true
const handlePushedHomeScreen = async() => {
  await cheatTip()
  if (settingState.setting['common.isAgreePact']) {
    if (isFirstPush) {
      isFirstPush = false
      void checkUpdate()
      void initDeeplink()
    }
  } else {
    if (isFirstPush) isFirstPush = false
    showPactModal()
  }
}

let isInited = false
export default async() => {
  if (isInited) return handlePushedHomeScreen
  bootLog('Initing...')
  commonActions.setFontSize(global.lx.fontSize)
  bootLog('Font size changed.')
  const setting = await initSetting()
  bootLog('Setting inited.')
  // console.log(setting)

  await initTheme(setting)
  bootLog('Theme inited.')
  await initI18n(setting)
  bootLog('I18n inited.')

  await initUserApi(setting)
  bootLog('User Api inited.')

  setApiSource(setting['common.apiSource'])
  bootLog('Api inited.')

  registerPlaybackService()
  bootLog('Playback Service Registered.')
  await initPlayer(setting)
  bootLog('Player inited.')
  await dataInit(setting)
  bootLog('Data inited.')
  void retryStaleCoverFailures()
  BackgroundTimer.setInterval(() => { void retryStaleCoverFailures() }, 30 * 60 * 1000)
  await initCommonState(setting)
  bootLog('Common State inited.')
  initVersionLifecycle()
  bootLog('Version lifecycle inited.')

  void initSync(setting)
  bootLog('Sync inited.')

  // syncSetting()

  isInited ||= true

  return handlePushedHomeScreen
}
