/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { getData, setData } from '@/plugins/storage'
import { isDevBuild } from '@/utils/releaseChannel'

const STORAGE_KEY = 'lux.togetherDebugPanel'

let enabled = false
let loaded = false
const listeners = new Set<(value: boolean) => void>()

export const isTogetherDebugPanelBuild = (): boolean => isDevBuild(process.versions.app)

export const loadTogetherDebugPanelPreference = async(): Promise<boolean> => {
  if (!isTogetherDebugPanelBuild()) {
    enabled = false
    loaded = true
    return false
  }
  const stored = await getData<boolean>(STORAGE_KEY)
  enabled = stored === true
  loaded = true
  notify()
  return enabled
}

export const getTogetherDebugPanelEnabled = (): boolean => enabled && isTogetherDebugPanelBuild()

export const setTogetherDebugPanelEnabled = async(value: boolean): Promise<void> => {
  if (!isTogetherDebugPanelBuild()) return
  enabled = value
  await setData(STORAGE_KEY, value)
  notify()
}

export const subscribeTogetherDebugPanel = (listener: (value: boolean) => void): (() => void) => {
  listeners.add(listener)
  if (loaded) listener(getTogetherDebugPanelEnabled())
  return () => { listeners.delete(listener) }
}

const notify = () => {
  const value = getTogetherDebugPanelEnabled()
  for (const listener of listeners) listener(value)
}
