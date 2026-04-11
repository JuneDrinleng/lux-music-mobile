/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

import '@/utils/errorHandle'
import { init as initLog } from '@/utils/log'
import { bootLog, getBootLog } from '@/utils/bootLog'
import '@/config/globalData'
import { getFontSize } from '@/utils/data'
import { exitApp } from './utils/nativeModules/utils'
import { windowSizeTools } from './utils/windowSizeTools'
import { listenLaunchEvent } from './navigation/regLaunchedEvent'
import { tipDialog } from './utils/tools'

console.log('starting app...')
listenLaunchEvent()

const LAUNCH_SCREEN_MIN_DURATION = 3500
const delay = async(ms: number) => new Promise<void>(resolve => {
  setTimeout(resolve, ms)
})

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
    await handleInit()
    if (!isInited) return
    const remainDuration = LAUNCH_SCREEN_MIN_DURATION - (Date.now() - launchStartedAt)
    if (remainDuration > 0) await delay(remainDuration)
    // import('@/utils/nativeModules/cryptoTest')

    await navigations.pushHomeScreen().then(() => {
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
