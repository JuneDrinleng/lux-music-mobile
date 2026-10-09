/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

import '@/utils/errorHandle'
import { init as initLog } from '@/utils/log'
import { bootLog, getBootLog } from '@/utils/bootLog'
import '@/config/globalData'
import { getFontSize, getSyncLoginCompleted } from '@/utils/data'
import { exitApp } from './utils/nativeModules/utils'
import { windowSizeTools } from './utils/windowSizeTools'
import { listenLaunchEvent } from './navigation/regLaunchedEvent'
import { tipDialog } from './utils/tools'
import { getData } from '@/plugins/storage'
import { storageDataPrefix } from '@/config/constant'

console.log('starting app...')
listenLaunchEvent()

void Promise.all([getFontSize(), windowSizeTools.init()]).then(async([fontSize]) => {
  global.lx.fontSize = fontSize
  bootLog('Font size setting loaded.')

  let isInited = false
  let handlePushedHomeScreen: () => void | Promise<void>

  const tryGetBootLog = () => {
    try {
      return getBootLog()
    } catch (err) {
      return 'Get boot log failed.'
    }
  }

  const handleInit = async() => {
    if (isInited) return
    void initLog()
    const { default: init } = await import('@/core/init')
    try {
      handlePushedHomeScreen = await init()
    } catch (err: any) {
      void tipDialog({
        title: '初始化失败 (Init Failed)',
        message: `Boot Log:\n${tryGetBootLog()}\n\n${(err.stack ?? err.message) as string}`,
        btnText: 'Exit',
        bgClose: false,
      }).then(() => {
        exitApp()
      })
      return
    }
    isInited ||= true
  }
  const { init: initNavigation, navigations } = await import('@/navigation')

  initNavigation(async() => {
    const launchStartedAt = Date.now()
    global.lx.isShowingLaunchScreen = true

    const isLaunchScreenShown = await navigations.pushLaunchScreen().then(() => {
      bootLog('Launch screen shown.')
      return true
    }).catch((err: any) => {
      void tipDialog({
        title: 'Error',
        message: err.message,
        btnText: 'Exit',
        bgClose: false,
      }).then(() => {
        exitApp()
      })
      return false
    })

    if (!isLaunchScreenShown) return
    const bootModulePromise = import('@/utils/homeFirstScreenBoot')
    void bootModulePromise.then(mod => { void mod.primeHomeBootTheme() })
    await handleInit()
    if (!isInited) return

    const { homeBootDeadline } = await import('@/utils/homeBootGate')
    const {
      armHomeBootSplash,
      markHomeBootRevealed,
      peekHomeBootBackground,
      raceWithDeadline,
      startHomeFirstScreenBoot,
      waitUntilHomeBootReveal,
    } = await bootModulePromise
    const preloadStartedAt = Date.now()
    const boot = startHomeFirstScreenBoot()

    const pushSyncLoginScreen = async() => {
      global.lx._onLoginConfirmed = handlePushedHomeScreen
      await navigations.pushSyncLoginScreen().catch((err: any) => {
        void tipDialog({
          title: 'Error',
          message: err.message,
          btnText: 'Exit',
          bgClose: false,
        }).then(() => {
          exitApp()
        })
      })
    }

    // 首次启动：展示登录页，合并勾选所有启动时弹窗
    const hasSeenCheatTip = await getData<boolean>(storageDataPrefix.cheatTip)
    if (!hasSeenCheatTip) {
      global.lx._onLoginConfirmed = handlePushedHomeScreen
      await navigations.pushLoginScreen().catch((err: any) => {
        void tipDialog({
          title: 'Error',
          message: err.message,
          btnText: 'Exit',
          bgClose: false,
        }).then(() => {
          exitApp()
        })
      })
      return
    }

    if (!await getSyncLoginCompleted()) {
      await pushSyncLoginScreen()
      return
    }

    const deadline = homeBootDeadline(launchStartedAt, preloadStartedAt)
    await raceWithDeadline(boot.mount, deadline)
    armHomeBootSplash()
    await navigations.pushHomeScreen({
      immediate: true,
      backgroundColor: peekHomeBootBackground(),
    }).then(async() => {
      await waitUntilHomeBootReveal({
        launchStartedAt,
        preloadStartedAt,
        covers: boot.covers,
      })
      markHomeBootRevealed()
      global.lx.isShowingLaunchScreen = false
      void handlePushedHomeScreen()
    }).catch((err: any) => {
      void tipDialog({
        title: 'Error',
        message: err.message,
        btnText: 'Exit',
        bgClose: false,
      }).then(() => {
        exitApp()
      })
    })
  })
}).catch((err) => {
  void tipDialog({
    title: '初始化失败 (Init Failed)',
    message: `Boot Log:\n\n${(err.stack ?? err.message) as string}`,
    btnText: 'Exit',
    bgClose: false,
  }).then(() => {
    exitApp()
  })
})
