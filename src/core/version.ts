/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

import { AppState, type AppStateStatus } from 'react-native'
import { Navigation } from 'react-native-navigation'
import { showVersionModal } from '@/navigation'
import settingState from '@/store/setting/state'
import { pickUpdateTarget, resolveChannel } from '@/utils/releaseChannel'
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

const getErrorMessage = (err: unknown) => {
  if (!err) return ''
  if (typeof err == 'string') return err
  if (err instanceof Error) return err.message || ''
  if (typeof err == 'object' && 'message' in err) return String(err.message ?? '')
  return String(err)
}

const isNoSpaceError = (err: unknown) => {
  const message = getErrorMessage(err).toLowerCase()
  if (!message) return false
  return [
    'enospc',
    'no space left on device',
    'not enough space',
    'insufficient storage',
    'disk full',
  ].some(flag => message.includes(flag))
}

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

export const checkUpdate = (options: CheckUpdateOptions = {}): Promise<void> | undefined => {
  if (checkUpdateTask) {
    if (!options.force) return checkUpdateTask
    return checkUpdateTask.then(async() => {
      await checkUpdate(options)
    }, async() => {
      await checkUpdate(options)
    })
  }
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

    const channel = resolveChannel(settingState.setting['common.releaseChannel'], versionInfo.version)
    try {
      const raw = await getVersionInfo()
      if (raw == null || typeof raw.version != 'string') throw new Error('failed')
      const history: Array<{ version: string, desc: string }> = []
      if (Array.isArray(raw.history)) {
        for (const item of raw.history) {
          if (item != null && typeof item.version == 'string') {
            history.push({
              version: item.version,
              desc: typeof item.desc == 'string' ? item.desc : '',
            })
          }
        }
      }
      const dev = raw.dev != null && typeof raw.dev.version == 'string'
        ? {
            version: raw.dev.version,
            desc: typeof raw.dev.desc == 'string' ? raw.dev.desc : '',
            date: typeof raw.dev.date == 'string' ? raw.dev.date : undefined,
          }
        : undefined
      const picked = pickUpdateTarget({
        version: raw.version,
        desc: typeof raw.desc == 'string' ? raw.desc : '',
        history,
        dev,
      }, versionInfo.version, channel)
      versionInfo.newVersion = picked.target
      versionInfo.channel = picked.channel
      versionInfo.waitStable = picked.waitStable
      versionInfo.isLatest = picked.isLatest
    } catch {
      versionInfo.newVersion = {
        version: '0.0.0',
        desc: '',
        history: [],
      }
      versionInfo.channel = channel
      versionInfo.waitStable = false
      versionInfo.isLatest = false
    }

    if (versionInfo.newVersion.version == '0.0.0') {
      versionInfo.isUnknown = true
      versionInfo.isLatest = false
      versionInfo.waitStable = false
      versionInfo.status = 'error'
    } else {
      versionInfo.status = 'idle'
      versionInfo.isUnknown = false
    }

    versionActions.setVersionInfo(versionInfo)

    if (!versionInfo.isLatest && !versionInfo.waitStable) {
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
    }).catch((err: unknown) => {
      if (sessionId != downloadSession) return
      if (isNoSpaceError(err)) {
        versionActions.setVersionInfo({ status: 'error' })
        currentDownloadVersion = null
        toast('Not enough storage space for update package.')
        return
      }
      retryCount += 1
      if (retryCount < maxDownloadRetry) {
        setTimeout(runDownload, downloadRetryDelayMs)
        return
      }
      versionActions.setVersionInfo({ status: 'error' })
      currentDownloadVersion = null
      const message = getErrorMessage(err)
      toast(message ? `${global.i18n.t('version_tip_failed')}\n${message}` : global.i18n.t('version_tip_failed'))
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

  if (versionState.versionInfo.status == 'downloaded') {
    // Returning from installer does not guarantee install succeeded; re-check actual app version.
    versionActions.setVersionInfo({ status: 'idle' })
    void checkUpdate({ force: true })
    return
  }

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
