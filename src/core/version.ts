import { AppState, type AppStateStatus } from 'react-native'
import { Navigation } from 'react-native-navigation'
import { compareVer } from '@/utils'
import { showVersionModal } from '@/navigation'
import versionActions from '@/store/version/action'
import versionState, { type InitState } from '@/store/version/state'
import { getIgnoreVersion, getIgnoreVersionFailTipTime, saveIgnoreVersion, saveIgnoreVersionFailTipTime } from '@/utils/data'
import { toast } from '@/utils/tools'
import { downloadNewVersion, getVersionInfo, isVersionDownloadActive } from '@/utils/version'

const maxDownloadRetry = 3
const downloadRetryDelayMs = 1500
const downloadStaleMs = 45000
const foregroundCheckThrottleMs = 45000

let checkUpdateTask: Promise<void> | null = null
let lastCheckUpdateTime = 0
let appState = AppState.currentState
let isVersionLifecycleInited = false
let downloadSession = 0
let currentDownloadVersion: string | null = null
let lastDownloadProgressTime = 0

interface CheckUpdateOptions {
  force?: boolean
  throttleMs?: number
}

export const showModal = () => {
  if (versionState.showModal) return
  versionActions.setVisibleModal(true)
  showVersionModal()
}

export const hideModal = (componentId: string) => {
  if (!versionState.showModal) return
  versionActions.setVisibleModal(false)
  void Navigation.dismissOverlay(componentId)
}

export const checkUpdate = async(options: CheckUpdateOptions = {}) => {
  if (checkUpdateTask) return checkUpdateTask
  if (versionState.versionInfo.status == 'downloading' && !options.force) return

  const now = Date.now()
  if (!options.force && options.throttleMs != null && now - lastCheckUpdateTime < options.throttleMs) return

  checkUpdateTask = (async() => {
    versionActions.setVersionInfo({
      status: 'checking',
      isUnknown: false,
      isLatest: false,
    })

    const versionInfo: InitState['versionInfo'] = {
      ...versionState.versionInfo,
      status: 'checking',
      isUnknown: false,
      isLatest: false,
    }

    try {
      const { version, desc, history } = await getVersionInfo()
      versionInfo.newVersion = {
        version,
        desc,
        history,
      }
    } catch {
      versionInfo.newVersion = {
        version: '0.0.0',
        desc: '',
        history: [],
      }
    }

    if (versionInfo.newVersion.version == '0.0.0') {
      versionInfo.isUnknown = true
      versionInfo.isLatest = false
      versionInfo.status = 'error'
    } else {
      versionInfo.status = 'idle'
      versionInfo.isUnknown = false
      versionInfo.isLatest = compareVer(versionInfo.version, versionInfo.newVersion.version) != -1
    }

    versionActions.setVersionInfo(versionInfo)

    if (!versionInfo.isLatest) {
      if (versionInfo.isUnknown) {
        const time = await getIgnoreVersionFailTipTime()
        if (Date.now() - time < 7 * 86400000) return
        saveIgnoreVersionFailTipTime(Date.now())
        toast(global.i18n.t('version_tip_unknown'))
      } else if (versionInfo.newVersion.version != await getIgnoreVersion()) {
        showModal()
      }
    }
  })().finally(() => {
    lastCheckUpdateTime = Date.now()
    checkUpdateTask = null
  })

  return checkUpdateTask
}

const runDownloadWithRetry = (targetVersion: string) => {
  const sessionId = ++downloadSession
  let retryCount = 0

  currentDownloadVersion = targetVersion
  lastDownloadProgressTime = Date.now()

  versionActions.setVersionInfo({ status: 'downloading', isLatest: false })
  versionActions.setProgress({ total: 0, current: 0 })

  const runDownload = () => {
    void downloadNewVersion(targetVersion, (total: number, current: number) => {
      if (sessionId != downloadSession) return
      lastDownloadProgressTime = Date.now()
      versionActions.setProgress({ total, current })
    }).then(() => {
      if (sessionId != downloadSession) return
      versionActions.setVersionInfo({ status: 'downloaded' })
      currentDownloadVersion = null
    }).catch(() => {
      if (sessionId != downloadSession) return
      retryCount += 1
      if (retryCount < maxDownloadRetry) {
        setTimeout(runDownload, downloadRetryDelayMs)
        return
      }
      versionActions.setVersionInfo({ status: 'error' })
      currentDownloadVersion = null
      toast(global.i18n.t('version_tip_failed'))
    })
  }

  runDownload()
}

export const downloadUpdate = () => {
  const targetVersion = versionState.versionInfo.newVersion?.version
  if (!targetVersion) return

  if (
    versionState.versionInfo.status == 'downloading' &&
    currentDownloadVersion == targetVersion &&
    isVersionDownloadActive()
  ) return

  runDownloadWithRetry(targetVersion)
}

const recoverDownloadIfNeeded = () => {
  const targetVersion = currentDownloadVersion ?? versionState.versionInfo.newVersion?.version
  if (!targetVersion) {
    versionActions.setVersionInfo({ status: 'idle' })
    void checkUpdate({ force: true })
    return
  }

  const isStalled =
    !isVersionDownloadActive() ||
    !lastDownloadProgressTime ||
    Date.now() - lastDownloadProgressTime > downloadStaleMs

  if (isStalled) runDownloadWithRetry(targetVersion)
}

const handleAppStateChange = (nextState: AppStateStatus) => {
  const prevState = appState
  appState = nextState
  if (nextState != 'active' || prevState == 'active') return

  if (versionState.versionInfo.status == 'downloading') {
    recoverDownloadIfNeeded()
    return
  }

  if (versionState.versionInfo.status == 'downloaded') return

  void checkUpdate({ throttleMs: foregroundCheckThrottleMs })
}

export const initVersionLifecycle = () => {
  if (isVersionLifecycleInited) return
  isVersionLifecycleInited = true
  AppState.addEventListener('change', handleAppStateChange)
}

export const setIgnoreVersion = (version: InitState['ignoreVersion']) => {
  versionActions.setIgnoreVersion(version)
  saveIgnoreVersion(version)
}
