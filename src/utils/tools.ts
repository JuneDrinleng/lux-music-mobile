/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

import { Platform, ToastAndroid, BackHandler, Linking, Dimensions, Appearance, PermissionsAndroid, AppState, StyleSheet, type ScaledSize } from 'react-native'
// import ExtraDimensions from 'react-native-extra-dimensions-android'
import Clipboard from '@react-native-clipboard/clipboard'
import { storageDataPrefix } from '@/config/constant'
import { gzipFile, readFile, temporaryDirectoryPath, unGzipFile, unlink, writeFile } from '@/utils/fs'
import { getSystemLocales, isIgnoringBatteryOptimization, isNotificationsEnabled, requestNotificationPermission, requestIgnoreBatteryOptimization, shareText } from '@/utils/nativeModules/utils'
import musicSdk from '@/utils/musicSdk'
import { getData, removeData, saveData } from '@/plugins/storage'
import BackgroundTimer from 'react-native-background-timer'
import { scaleSizeH, scaleSizeW, setSpText } from './pixelRatio'
import { toOldMusicInfo } from './index'
import { stringMd5 } from 'react-native-quick-md5'
import { windowSizeTools } from '@/utils/windowSizeTools'
import { type PermissionPromptAction, type PermissionPromptPayload } from '@/types/permissionPrompt'
import { type AppDialogAction, type AppDialogPayload } from '@/types/appDialog'


// https://stackoverflow.com/a/47349998
export const getDeviceLanguage = async() => {
  // let deviceLanguage = Platform.OS === 'ios'
  //   ? NativeModules.SettingsManager.settings.AppleLocale ||
  //     NativeModules.SettingsManager.settings.AppleLanguages[0] // iOS 13
  //   : await getSystemLocales()
  // deviceLanguage = typeof deviceLanguage === 'string' ? deviceLanguage.substring(0, 5).toLocaleLowerCase() : ''
  return getSystemLocales()
}


export const isAndroid = Platform.OS === 'android'
// @ts-expect-error
export const osVer = Platform.constants.Release as string

export const isActive = () => AppState.currentState == 'active'

export const TEMP_FILE_PATH = temporaryDirectoryPath + '/tempFile'

// fix https://github.com/facebook/react-native/issues/4934
// export const getWindowSise = (windowDimensions?: ReturnType<(typeof Dimensions)['get']>) => {
//   return windowSizeTools.getSize()
//   // windowDimensions ??= Dimensions.get('window')
//   // if (Platform.OS === 'ios') return windowDimensions
//   // return windowDimensions
//   // const windowSize = {
//   //   width: ExtraDimensions.getRealWindowWidth(),
//   //   height: ExtraDimensions.getRealWindowHeight(),
//   // }
//   // if (
//   //   (windowDimensions.height > windowDimensions.width && windowSize.height < windowSize.width) ||
//   //   (windowDimensions.width > windowDimensions.height && windowSize.width < windowSize.height)
//   // ) {
//   //   windowSize.height = windowSize.width
//   // }
//   // windowSize.width = windowDimensions.width

//   // if (ExtraDimensions.isSoftMenuBarEnabled()) {
//   //   windowSize.height -= ExtraDimensions.getSoftMenuBarHeight()
//   // }
//   // return windowSize
// }

export const checkStoragePermissions = async() => PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE)

export const requestStoragePermission = async() => {
  const isGranted = await checkStoragePermissions()
  if (isGranted) return isGranted

  try {
    const granted = await PermissionsAndroid.requestMultiple(
      [
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      ],
      // {
      //   title: '存储读写权限申请',
      //   message:
      //     '洛雪音乐助手需要使用存储读写权限才能下载歌曲.',
      //   buttonNeutral: '一会再问我',
      //   buttonNegative: '取消',
      //   buttonPositive: '确定',
      // },
    )
    // console.log(granted)
    // console.log(Object.values(granted).every(r => r === PermissionsAndroid.RESULTS.GRANTED))
    // console.log(PermissionsAndroid.RESULTS)
    const granteds = Object.values(granted)
    return granteds.every(r => r === PermissionsAndroid.RESULTS.GRANTED)
      ? true
      : granteds.includes(PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN)
        ? null
        : false
    // if (granted === PermissionsAndroid.RESULTS.GRANTED) {
    //   console.log('You can use the storage')
    // } else {
    //   console.log('Storage permission denied')
    // }
  } catch (err: any) {
    // console.warn(err)
    return false
  }
}


/**
 * 显示toast
 * @param message 消息
 * @param duration 时长
 * @param position 位置
 */
export const toast = (message: string, duration: 'long' | 'short' = 'short', position: 'top' | 'center' | 'bottom' = 'bottom') => {
  let _duration
  switch (duration) {
    case 'long':
      _duration = ToastAndroid.LONG
      break
    case 'short':
    default:
      _duration = ToastAndroid.SHORT
      break
  }
  let _position
  let offset: number
  switch (position) {
    case 'top':
      _position = ToastAndroid.TOP
      offset = 120
      break
    case 'center':
      _position = ToastAndroid.CENTER
      offset = 0
      break
    case 'bottom':
    default:
      _position = ToastAndroid.BOTTOM
      offset = 120
      break
  }
  ToastAndroid.showWithGravityAndOffset(message, _duration, _position, 0, offset)
}

export const openUrl = async(url: string): Promise<void> => Linking.canOpenURL(url).then(async() => Linking.openURL(url))

export const assertApiSupport = (source: LX.Source): boolean => {
  return source == 'local' || global.lx.qualityList[source] != null
}

// const handleRemoveDataMultiple = async keys => {
//   await removeDataMultiple(keys.splice(0, 500))
//   if (keys.length) return handleRemoveDataMultiple(keys)
// }

export const exitApp = () => {
  BackHandler.exitApp()
}

export const handleSaveFile = async(path: string, data: any) => {
  // if (!path.endsWith('.json')) path += '.json'
  // const buffer = gzip(data)
  const tempFilePath = `${temporaryDirectoryPath}/tempFile.json`
  await writeFile(tempFilePath, JSON.stringify(data))
  await gzipFile(tempFilePath, path)
  await unlink(tempFilePath)
}
export const handleReadFile = async<T = unknown>(path: string): Promise<T> => {
  let isJSON = path.endsWith('.json')
  let data
  if (isJSON) {
    data = await readFile(path)
  } else {
    const tempFilePath = `${temporaryDirectoryPath}/tempFile.json`
    await unGzipFile(path, tempFilePath)
    data = await readFile(tempFilePath)
    await unlink(tempFilePath)
  }
  data = JSON.parse(data)

  // 修复PC v1.14.0出现的导出数据被序列化两次的问题
  if (typeof data != 'object') {
    try {
      data = JSON.parse(data as string)
    } catch (err) {
      return data
    }
  }

  return data
}

const waitForPromptHostReady = async(flag: 'appDialogReady' | 'permissionPromptReady', timeout = 1500) => {
  if (Reflect.get(global.lx, flag) === true) return true
  const startTime = Date.now()
  return new Promise<boolean>((resolve) => {
    const check = () => {
      if (Reflect.get(global.lx, flag) === true) {
        resolve(true)
        return
      }
      if (Date.now() - startTime >= timeout) {
        resolve(false)
        return
      }
      setTimeout(check, 50)
    }
    check()
  })
}

const createAppDialogId = () => `app_dialog_${Date.now()}_${Math.random().toString(16).slice(2)}`
const showAppDialog = async({
  title,
  message,
  cancelText,
  confirmText,
  showConfirm = true,
  bgHide = true,
}: Omit<AppDialogPayload, 'requestId'>): Promise<AppDialogAction> => {
  const ready = await waitForPromptHostReady('appDialogReady')
  if (!ready) return 'cancel'

  const requestId = createAppDialogId()

  return new Promise<AppDialogAction>((resolve) => {
    const handleResult = (targetRequestId: string, action: AppDialogAction) => {
      if (targetRequestId != requestId) return
      global.app_event.off('appDialogResult', handleResult)
      resolve(action)
    }
    global.app_event.on('appDialogResult', handleResult)
    global.app_event.showAppDialog({
      requestId,
      title,
      message,
      cancelText,
      confirmText,
      showConfirm,
      bgHide,
    })
  })
}

export const confirmDialog = async({
  title = '',
  message = '',
  cancelButtonText = global.i18n.t('dialog_cancel'),
  confirmButtonText = global.i18n.t('dialog_confirm'),
  bgClose = true,
}) => {
  const action = await showAppDialog({
    title,
    message,
    cancelText: cancelButtonText,
    confirmText: confirmButtonText,
    showConfirm: true,
    bgHide: bgClose,
  })
  return action == 'confirm'
}

export const tipDialog = async({
  title = '',
  message = '',
  btnText = global.i18n.t('dialog_confirm'),
  bgClose = true,
}) => {
  await showAppDialog({
    title,
    message,
    cancelText: btnText,
    confirmText: btnText,
    showConfirm: false,
    bgHide: bgClose,
  })
}

export const clipboardWriteText = (str: string) => {
  Clipboard.setString(str)
}


export const checkNotificationPermission = async() => {
  const isHide = await getData(storageDataPrefix.notificationTipEnable)
  if (isHide != null) return
  const enabled = await isNotificationsEnabled()
  if (enabled) return
  const action = await showPermissionPrompt({
    title: global.i18n.t('notifications_check_title'),
    message: global.i18n.t('notifications_check_tip'),
    cancelText: global.i18n.t('disagree'),
    confirmText: global.i18n.t('agree_go'),
    extraText: global.i18n.t('never_show'),
  })
  if (action == 'extra') {
    await saveData(storageDataPrefix.notificationTipEnable, '1')
    toast(global.i18n.t('disagree_tip'))
    return
  }
  if (action == 'cancel') {
    toast(global.i18n.t('disagree_tip'))
    return
  }
  if (action == 'confirm') {
    const result = await requestNotificationPermission()
    if (!result) toast(global.i18n.t('disagree_tip'))
  }
}


export const checkIgnoringBatteryOptimization = async() => {
  const isHide = await getData(storageDataPrefix.ignoringBatteryOptimizationTipEnable)
  if (isHide != null) return
  const enabled = await isIgnoringBatteryOptimization()
  if (enabled) return
  const action = await showPermissionPrompt({
    title: global.i18n.t('ignoring_battery_optimization_check_title'),
    message: global.i18n.t('ignoring_battery_optimization_check_tip'),
    cancelText: global.i18n.t('disagree'),
    confirmText: global.i18n.t('agree_to'),
    extraText: global.i18n.t('never_show'),
  })
  if (action == 'extra') {
    await saveData(storageDataPrefix.ignoringBatteryOptimizationTipEnable, '1')
    toast(global.i18n.t('disagree_tip'))
    return
  }
  if (action == 'cancel') {
    toast(global.i18n.t('disagree_tip'))
    return
  }
  if (action == 'confirm') {
    const result = await requestIgnoreBatteryOptimization()
    if (!result) toast(global.i18n.t('disagree_tip'))
  }
}
export const resetNotificationPermissionCheck = async() => {
  return removeData(storageDataPrefix.notificationTipEnable)
}
export const resetIgnoringBatteryOptimizationCheck = async() => {
  return removeData(storageDataPrefix.ignoringBatteryOptimizationTipEnable)
}

const createPermissionPromptId = () => `permission_prompt_${Date.now()}_${Math.random().toString(16).slice(2)}`
const showPermissionPrompt = async({
  title,
  message,
  cancelText,
  confirmText,
  extraText,
  bgHide = false,
}: Omit<PermissionPromptPayload, 'requestId'>): Promise<PermissionPromptAction> => {
  const ready = await waitForPromptHostReady('permissionPromptReady')
  if (!ready) return 'cancel'

  const requestId = createPermissionPromptId()

  return new Promise<PermissionPromptAction>((resolve) => {
    const handleResult = (targetRequestId: string, action: PermissionPromptAction) => {
      if (targetRequestId != requestId) return
      global.app_event.off('permissionPromptResult', handleResult)
      resolve(action)
    }
    global.app_event.on('permissionPromptResult', handleResult)
    global.app_event.showPermissionPrompt({
      requestId,
      title,
      message,
      cancelText,
      confirmText,
      extraText,
      bgHide,
    })
  })
}

export const shareMusic = (shareType: LX.ShareType, downloadFileName: LX.AppSetting['download.fileName'], musicInfo: LX.Music.MusicInfo) => {
  const name = musicInfo.name
  const singer = musicInfo.singer
  const detailUrl = musicInfo.source == 'local' ? '' : musicSdk[musicInfo.source]?.getMusicDetailPageUrl(toOldMusicInfo(musicInfo)) ?? ''
  const musicTitle = downloadFileName.replace('歌名', name).replace('歌手', singer)
  const plainTitle = musicTitle.replace(/\s/g, '')
  // URL-first improves the chance of IM apps (e.g. WeChat) parsing it as a rich link card.
  const systemShareText = detailUrl || plainTitle
  const clipboardShareText = detailUrl ? `${musicTitle}\n${detailUrl}` : musicTitle
  switch (shareType) {
    case 'system':
      void shareText(global.i18n.t('share_card_title_music', { name }), global.i18n.t('share_title_music'), systemShareText)
      break
    case 'clipboard':
      clipboardWriteText(clipboardShareText)
      toast(global.i18n.t('copy_name_tip'))
      break
  }
}

export const onDimensionChange = (handler: (info: { window: ScaledSize, screen: ScaledSize }) => void) => {
  return Dimensions.addEventListener('change', handler)
}


export const getAppearance = () => {
  return Appearance.getColorScheme() ?? 'light'
}

export const onAppearanceChange = (callback: (colorScheme: Parameters<Parameters<typeof Appearance['addChangeListener']>[0]>[0]['colorScheme']) => void) => {
  return Appearance.addChangeListener(({ colorScheme }) => {
    callback(colorScheme)
  })
}

let isSupportedAutoTheme: boolean | null = null
export const getIsSupportedAutoTheme = () => {
  if (isSupportedAutoTheme == null) {
    const osVerNum = parseInt(osVer)
    isSupportedAutoTheme = isAndroid
      ? osVerNum >= 5
      : osVerNum >= 13
  }
  return isSupportedAutoTheme
}


export const showImportTip = (type: string) => {
  let message
  switch (type) {
    case 'defautlList':
    case 'playList':
    case 'playList_v2':
      message = global.i18n.t('list_import_tip__playlist')
      break
    case 'setting':
    case 'setting_v2':
      message = global.i18n.t('list_import_tip__setting')
      break
    case 'allData':
    case 'allData_v2':
      message = global.i18n.t('list_import_tip__alldata')
      break
    case 'playListPart':
    case 'playListPart_v2':
      message = global.i18n.t('list_import_tip__playlist_part')
      break

    default:
      message = global.i18n.t('list_import_tip__unknown')
      break
  }
  void tipDialog({
    title: global.i18n.t('list_import_tip__failed'),
    message,
    btnText: global.i18n.t('ok'),
  })
}


/**
 * 生成节流函数
 * @param fn 回调
 * @param delay 延迟
 * @returns
 */
export function throttleBackgroundTimer<Args extends any[]>(fn: (...args: Args) => void | Promise<void>, delay = 100) {
  let timer: number | null = null
  let _args: Args
  return (...args: Args) => {
    _args = args
    if (timer) return
    timer = BackgroundTimer.setTimeout(() => {
      timer = null
      void fn(..._args)
    }, delay)
  }
}

/**
 * 生成防抖函数
 * @param fn 回调
 * @param delay 延迟
 * @returns
 */
export function debounceBackgroundTimer<Args extends any[]>(fn: (...args: Args) => void | Promise<void>, delay = 100) {
  let timer: number | null = null
  let _args: Args
  return (...args: Args) => {
    _args = args
    if (timer) BackgroundTimer.clearTimeout(timer)
    timer = BackgroundTimer.setTimeout(() => {
      timer = null
      void fn(..._args)
    }, delay)
  }
}

// eslint-disable-next-line @typescript-eslint/ban-types
type Styles = StyleSheet.NamedStyles<Record<string, {}>>
type Style = Styles[keyof Styles]
const trasformeProps: Array<keyof Style> = [
  // @ts-expect-error
  'fontSize',
  // @ts-expect-error
  'lineHeight',
  // 'margin',
  // 'marginLeft',
  // 'marginRight',
  // 'marginTop',
  // 'marginBottom',
  // 'padding',
  // 'paddingLeft',
  // 'paddingRight',
  // 'paddingTop',
  // 'paddingBottom',
  'left',
  'right',
  'top',
  'bottom',
]
export const trasformeStyle = <T extends Style>(styles: T): T => {
  const newStyle: T = { ...styles }

  for (const [p, v] of Object.entries(newStyle) as Array<[keyof Style, Style[keyof Style]]>) {
    if (typeof v != 'number') continue
    switch (p) {
      case 'height':
      case 'minHeight':
      case 'marginTop':
      case 'marginBottom':
      case 'paddingTop':
      case 'paddingBottom':
      case 'paddingVertical':
        newStyle[p] = scaleSizeH(v)
        break
      case 'width':
      case 'minWidth':
      case 'marginLeft':
      case 'marginRight':
      case 'paddingLeft':
      case 'paddingRight':
      case 'paddingHorizontal':
      case 'gap':
        newStyle[p] = scaleSizeW(v)
        break
      case 'padding':
        newStyle.paddingRight = newStyle.paddingLeft = scaleSizeW(v)
        newStyle.paddingBottom = newStyle.paddingTop = scaleSizeH(v)
        break
      case 'margin':
        newStyle.marginRight = newStyle.marginLeft = scaleSizeW(v)
        newStyle.marginBottom = newStyle.marginTop = scaleSizeH(v)
        break
      default:
        // @ts-expect-error
        if (trasformeProps.includes(p)) newStyle[p] = setSpText(v)
        break
    }
  }
  return newStyle
}

export const createStyle = <T extends StyleSheet.NamedStyles<T>>(styles: T | StyleSheet.NamedStyles<T>): T => {
  const newStyle: Record<string, Style> = { ...styles }
  for (const [n, s] of Object.entries(newStyle)) {
    newStyle[n] = trasformeStyle(s)
  }
  // @ts-expect-error
  return StyleSheet.create(newStyle as StyleSheet.NamedStyles<T>)
}

export const isHorizontalMode = (width: number, height: number): boolean => {
  return width / height > 1.2
}


export interface RowInfo {
  rowNum: number | undefined
  rowWidth: `${number}%`
}

export type RowInfoType = 'full' | 'medium'

export const getRowInfo = (type: RowInfoType = 'full'): RowInfo => {
  const win = windowSizeTools.getSize()
  let isMultiRow = isHorizontalMode(win.width, win.height)
  if (type == 'medium' && win.width / win.height < 1.8) isMultiRow = false
  // console.log('getRowInfo')
  return {
    rowNum: isMultiRow ? 2 : undefined,
    rowWidth: isMultiRow ? '50%' : '100%',
  }
}

export const toMD5 = stringMd5


export const cheatTip = async() => {
  const isRead = await getData<boolean>(storageDataPrefix.cheatTip)
  if (isRead) return

  return tipDialog({
    title: '安全提醒',
    message: `1. 本项目没有任何“官方社群”或“收费解锁”渠道，请注意甄别，谨防受骗。

2. 如果你在使用过程中看到广告、引流或要求付费升级，通常说明你当前使用的是第三方修改版本。

3. 项目主要发布渠道为 GitHub，其他来源请自行判断可信度。`,
    btnText: '我知道了 (Close)',
    bgClose: true,
  }).then(() => {
    void saveData(storageDataPrefix.cheatTip, true)
  })
}

export const remoteLyricTip = async() => {
  const isRead = await getData<boolean>(storageDataPrefix.remoteLyricTip)
  if (isRead) return

  return tipDialog({
    title: '温馨提示',
    message: '如果你将该功能用于车机，请务必把安全放在第一位，驾驶时不要分心操作。',
    btnText: '我知道了 (Close)',
    bgClose: true,
  }).then(() => {
    void saveData(storageDataPrefix.remoteLyricTip, true)
  })
}
