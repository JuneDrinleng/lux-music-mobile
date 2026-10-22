/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md. */
import { useEffect, useSyncExternalStore } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { downloadQueue, initDownloads, type DownloadItem } from '@/core/download'
import { DOWNLOAD_QUALITIES, type DownloadQuality } from '@/core/download/presentation'

const empty: DownloadItem[] = []
const subscribe = (listener: () => void) => downloadQueue?.subscribe(listener) ?? (() => {})
const snapshot = () => downloadQueue?.getSnapshot() ?? empty
export const useDownloads = () => {
  const items = useSyncExternalStore(subscribe, snapshot)
  useEffect(() => { void initDownloads().then(async() => downloadQueue?.sync(true)).catch(() => {}) }, [])
  return items
}
let preferences = { quality: '320k' as DownloadQuality, wifiOnly: true }
const listeners = new Set<() => void>()
const key = 'lux.download.preferences.v1'
let loading: Promise<void> | undefined
let changed = false
const publish = () => { for (const listener of listeners) listener() }
export const setDownloadPreferences = (patch: Partial<typeof preferences>) => {
  changed = true
  preferences = { ...preferences, ...patch }
  publish()
  void AsyncStorage.setItem(key, JSON.stringify(preferences)).catch(() => {})
}
export const useDownloadPreferences = () => {
  const value = useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener) } }, () => preferences)
  useEffect(() => {
    loading ??= AsyncStorage.getItem(key).then(raw => {
      if (!raw || changed) return
      const parsed = JSON.parse(raw) as { quality: DownloadQuality, wifiOnly?: boolean }
      preferences = { quality: DOWNLOAD_QUALITIES.includes(parsed.quality) ? parsed.quality : '320k', wifiOnly: parsed.wifiOnly !== false }
      publish()
    }).catch(() => {})
  }, [])
  return value
}
