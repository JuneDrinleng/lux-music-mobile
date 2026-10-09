/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

import { AppState, NativeEventEmitter, NativeModules } from 'react-native'

const { UtilsModule } = NativeModules

export const exitApp = UtilsModule.exitApp

export interface DeviceAudioFile {
  path: string
  displayName: string
  title: string
  artist: string
  album: string
  durationMs: number
  size: number
}

export const listDeviceAudio = async(): Promise<DeviceAudioFile[]> => {
  if (typeof UtilsModule?.listDeviceAudio != 'function') return []
  const rows: unknown = await UtilsModule.listDeviceAudio()
  if (!Array.isArray(rows)) return []
  return rows.filter((row): row is DeviceAudioFile => {
    return Boolean(row) && typeof row == 'object' && typeof (row as DeviceAudioFile).path == 'string'
  })
}

export const getSupportedAbis = UtilsModule.getSupportedAbis

export interface BuildInfo {
  applicationId: string
  providerAuthority: string
  releaseAssetPrefix: string
  updateChannel: string
}

export const getBuildInfo = async(): Promise<BuildInfo> => {
  return UtilsModule.getBuildInfo()
}

export const installApk = (filePath: string, fileProviderAuthority: string) => UtilsModule.installApk(filePath, fileProviderAuthority)


export const screenkeepAwake = () => {
  if (global.lx.isScreenKeepAwake) return
  global.lx.isScreenKeepAwake = true
  UtilsModule.screenkeepAwake()
}
export const screenUnkeepAwake = () => {
  // console.log('screenUnkeepAwake')
  if (!global.lx.isScreenKeepAwake) return
  global.lx.isScreenKeepAwake = false
  UtilsModule.screenUnkeepAwake()
}

export const getWIFIIPV4Address = UtilsModule.getWIFIIPV4Address as () => Promise<string>

/** Unmetered active network from ConnectivityManager. False when the module or the call fails. */
export const isActiveNetworkUnmetered = async(): Promise<boolean> => {
  if (typeof UtilsModule?.isActiveNetworkUnmetered != 'function') return false
  try {
    const value: unknown = await UtilsModule.isActiveNetworkUnmetered()
    return value === true
  } catch {
    return false
  }
}

export const onNetworkUnmeteredChange = (handler: (unmetered: boolean) => void): () => void => {
  if (!UtilsModule) return () => {}
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const eventEmitter = new NativeEventEmitter(UtilsModule)
  const eventListener = eventEmitter.addListener('network-unmetered', (event: { unmetered?: boolean }) => {
    handler(event?.unmetered === true)
  })

  return () => {
    eventListener.remove()
  }
}

export const getDeviceName = async(): Promise<string> => {
  return UtilsModule.getDeviceName().then((deviceName: string) => deviceName || 'Unknown')
}

export const isNotificationsEnabled = UtilsModule.isNotificationsEnabled as () => Promise<boolean>

export const requestNotificationPermission = async() => new Promise<boolean>((resolve) => {
  let subscription = AppState.addEventListener('change', (state) => {
    if (state != 'active') return
    subscription.remove()
    setTimeout(() => {
      void isNotificationsEnabled().then(resolve)
    }, 1000)
  })
  UtilsModule.openNotificationPermissionActivity().then((result: boolean) => {
    if (result) return
    subscription.remove()
    resolve(false)
  })
})

export const shareText = async(shareTitle: string, title: string, text: string): Promise<void> => {
  UtilsModule.shareText(shareTitle, title, text)
}

export const getSystemLocales = async(): Promise<string> => {
  return UtilsModule.getSystemLocales()
}

export const onScreenStateChange = (handler: (state: 'ON' | 'OFF') => void): () => void => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const eventEmitter = new NativeEventEmitter(UtilsModule)
  const eventListener = eventEmitter.addListener('screen-state', event => {
    handler(event.state as 'ON' | 'OFF')
  })

  return () => {
    eventListener.remove()
  }
}

export const getWindowSize = async(): Promise<{ width: number, height: number }> => {
  return UtilsModule.getWindowSize()
}

export const onWindowSizeChange = (handler: (size: { width: number, height: number }) => void): () => void => {
  UtilsModule.listenWindowSizeChanged()
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const eventEmitter = new NativeEventEmitter(UtilsModule)
  const eventListener = eventEmitter.addListener('screen-size-changed', event => {
    handler(event as { width: number, height: number })
  })

  return () => {
    eventListener.remove()
  }
}

export const isIgnoringBatteryOptimization = async(): Promise<boolean> => {
  return UtilsModule.isIgnoringBatteryOptimization()
}

export const requestIgnoreBatteryOptimization = async() => new Promise<boolean>((resolve) => {
  let subscription = AppState.addEventListener('change', (state) => {
    if (state != 'active') return
    subscription.remove()
    setTimeout(() => {
      void isIgnoringBatteryOptimization().then(resolve)
    }, 1000)
  })
  UtilsModule.requestIgnoreBatteryOptimization().then((result: boolean) => {
    if (result) return
    subscription.remove()
    resolve(false)
  })
})

export const setSystemBarsTransparent = () => {
  if (!UtilsModule?.setSystemBarsTransparent) return
  UtilsModule.setSystemBarsTransparent()
}

/** Dark glyphs on light themes, light glyphs on 墨夜. Does not touch the upstream theme. */
export const setSystemBarIconStyle = (style: 'light' | 'dark') => {
  if (!UtilsModule?.setSystemBarIconStyle) return
  UtilsModule.setSystemBarIconStyle(style)
}
