import { bootTimestamp, bootStep, finishBootBuffer } from '@/utils/perfDiagnostics'
import { initializeAppSession } from '@/core/appSession'
import { initDownloads } from '@/core/download'
/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

import { migrateStoredLuxCredentials } from '@/utils/data'
import { initializeDataSpaces } from '@/utils/dataSpace'
import { initSetting, showPactModal } from '@/core/common'
import registerPlaybackService from '@/plugins/player/service'
import initTheme from './theme'
import initI18n from './i18n'
import initUserApi from './userApi'
import initPlayer from './player'
import initPlayHistory from './playHistory'
import dataInit from './dataInit'
import initSync from './sync'
import { initTogether } from '@/core/together'
import initCommonState from './common'
import { initDeeplink } from './deeplink'
import { setApiSource } from '@/core/apiSource'
import commonActions from '@/store/common/action'
import settingState from '@/store/setting/state'
import { checkUpdate, initVersionLifecycle } from '@/core/version'
import { bootLog } from '@/utils/bootLog'
import { getFailedEntries, clearCoverFailure, recordCoverFailure, isCoverFailureStale } from '@/utils/coverFailureRegistry'
import { fetchAltCoverUrl } from '@/core/music/utils'
import { getListMusics, updateListMusics } from '@/core/list'
import listState from '@/store/list/state'
import { primeImageCacheIndex, scheduleImageCacheTrim, setImageCacheLimits } from '@/utils/imageCache'
import { UNPINNED_IMAGE_CACHE_LIMIT } from '@/utils/imageCachePolicy'
import { loadPlaylistCoverStore } from '@/utils/playlistCoverStore'
import { installPlaylistCoverPrefetch, pinStoredPlaylistCovers, runIdlePlaylistCoverPrefetch } from '@/utils/playlistCoverPrefetch'
import { enforceListenListLimit } from '@/core/list/enforceListenListLimit'
import BackgroundTimer from 'react-native-background-timer'
import { InteractionManager } from 'react-native'

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
      const onlineSong = song
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
  const perfStep2 = bootTimestamp('init:migrateStoredLuxCredentials:start')
  await migrateStoredLuxCredentials()
  bootStep('migrateStoredLuxCredentials', perfStep2)
  const perfStep3 = bootTimestamp('init:initializeDataSpaces:start')
  await initializeDataSpaces()
  bootStep('initializeDataSpaces', perfStep3)
  const perfStep4 = bootTimestamp('init:appSessionImport:start')
  const { primeSessionRecovery } = await import('@/core/appSession')
  bootStep('appSessionImport', perfStep4)
  const perfStep5 = bootTimestamp('init:primeSessionRecovery:start')
  await primeSessionRecovery()
  bootStep('primeSessionRecovery', perfStep5)
  commonActions.setFontSize(global.lx.fontSize)
  bootLog('Font size changed.')
  const perfStep6 = bootTimestamp('init:initSetting:start')
  const setting = await initSetting()
  bootStep('initSetting', perfStep6)
  finishBootBuffer()
  bootLog('Setting inited.')
  // console.log(setting)

  const perfStep7 = bootTimestamp('init:initTheme:start')
  await initTheme(setting)
  bootStep('initTheme', perfStep7)
  bootLog('Theme inited.')
  const perfStep8 = bootTimestamp('init:initI18n:start')
  await initI18n(setting)
  bootStep('initI18n', perfStep8)
  bootLog('I18n inited.')

  const perfStep9 = bootTimestamp('init:initUserApi:start')
  await initUserApi(setting)
  bootStep('initUserApi', perfStep9)
  bootLog('User Api inited.')

  setApiSource(setting['common.apiSource'])
  bootLog('Api inited.')
  const perfStep10 = bootTimestamp('init:initDownloads:start')
  await initDownloads().catch(error => { bootLog(`Download init failed: ${String(error)}`) })
  bootStep('initDownloads', perfStep10)

  registerPlaybackService()
  bootLog('Playback Service Registered.')
  const perfStep11 = bootTimestamp('init:initPlayer:start')
  await initPlayer(setting)
  bootStep('initPlayer', perfStep11)
  bootLog('Player inited.')
  const perfStep12 = bootTimestamp('init:initPlayHistory:start')
  await initPlayHistory().catch(error => { bootLog(`Play history init failed: ${error instanceof Error ? error.message : error}`) })
  bootStep('initPlayHistory', perfStep12)
  bootLog('Play history inited.')
  const perfStep13 = bootTimestamp('init:dataInit:start')
  await dataInit(setting)
  bootStep('dataInit', perfStep13)
  bootLog('Data inited.')
  const perfStep14 = bootTimestamp('init:primeImageCacheIndex:start')
  await primeImageCacheIndex().catch(() => {})
  bootStep('primeImageCacheIndex', perfStep14)
  const perfStep15 = bootTimestamp('init:loadPlaylistCoverStore:start')
  await loadPlaylistCoverStore().catch(() => {})
  bootStep('loadPlaylistCoverStore', perfStep15)
  const imageCacheCount = parseInt(setting['player.imageCacheCount'] || '', 10)
  setImageCacheLimits(Number.isFinite(imageCacheCount) && imageCacheCount > 0 ? imageCacheCount : UNPINNED_IMAGE_CACHE_LIMIT)
  pinStoredPlaylistCovers()
  scheduleImageCacheTrim()
  installPlaylistCoverPrefetch()
  void enforceListenListLimit()
  void InteractionManager.runAfterInteractions(() => {
    setTimeout(() => { runIdlePlaylistCoverPrefetch() }, 1000)
  })
  void retryStaleCoverFailures()
  BackgroundTimer.setInterval(() => { void retryStaleCoverFailures() }, 30 * 60 * 1000)
  const perfStep16 = bootTimestamp('init:initCommonState:start')
  await initCommonState(setting)
  bootStep('initCommonState', perfStep16)
  bootLog('Common State inited.')
  initVersionLifecycle()
  bootLog('Version lifecycle inited.')

  const perfStep17 = bootTimestamp('init:initializeAppSession:start')
  await initializeAppSession()
  bootStep('initializeAppSession', perfStep17)
  initTogether()
  void initSync(setting)
  bootLog('Sync inited.')

  // syncSetting()

  isInited ||= true

  return handlePushedHomeScreen
}
