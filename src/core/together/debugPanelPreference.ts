/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { getData, setData } from '@/plugins/storage'
import settingState from '@/store/setting/state'
import { isDevBuild, resolveChannel } from '@/utils/releaseChannel'

const STORAGE_KEY = 'lux.togetherDebugPanel'

let enabled = false
let loaded = false
let loadPromise: Promise<boolean> | null = null
const listeners = new Set<(value: boolean) => void>()

export const isTogetherDebugPanelBuild = (): boolean => {
  const appVersion = process.versions.app
  if (isDevBuild(appVersion)) return true
  const channelSetting = settingState.setting['common.releaseChannel']
  return resolveChannel(channelSetting, appVersion) == 'dev'
}

export const loadTogetherDebugPanelPreference = async(): Promise<boolean> => {
  if (loadPromise) return loadPromise
  loadPromise = (async() => {
    if (!isTogetherDebugPanelBuild()) {
      enabled = false
      loaded = true
      notify()
      return false
    }
    const stored = await getData<boolean>(STORAGE_KEY)
    enabled = stored === true
    loaded = true
    notify()
    return getTogetherDebugPanelEnabled()
  })()
  return loadPromise
}

export const getTogetherDebugPanelEnabled = (): boolean => enabled && isTogetherDebugPanelBuild()

export const setTogetherDebugPanelEnabled = async(value: boolean): Promise<void> => {
  if (!isTogetherDebugPanelBuild()) return
  if (loadPromise) await loadPromise
  enabled = value
  loaded = true
  await setData(STORAGE_KEY, value)
  notify()
}

export const subscribeTogetherDebugPanel = (listener: (value: boolean) => void): (() => void) => {
  listeners.add(listener)
  if (loaded) listener(getTogetherDebugPanelEnabled())
  else void loadTogetherDebugPanelPreference().then(() => { listener(getTogetherDebugPanelEnabled()) })
  return () => { listeners.delete(listener) }
}

const notify = () => {
  const value = getTogetherDebugPanelEnabled()
  for (const listener of listeners) listener(value)
}
