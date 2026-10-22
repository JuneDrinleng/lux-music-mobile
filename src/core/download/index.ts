/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md. */
import { AppState, NativeEventEmitter, NativeModules, type NativeModule } from 'react-native'
import { getActiveSpace, onDataSpaceChanged, onDataSpaceWillChange } from '@/utils/dataSpace'
import { getMusicUrl } from '@/core/music/online'
import { createDownloadQueue, type DownloadBridge } from './model'
export type { DownloadItem, DownloadRequest, DownloadState } from './model'
export { downloadKey } from './model'

const bridge = NativeModules.DownloadModule as DownloadBridge | undefined
export const downloadQueue = bridge ? createDownloadQueue({
  bridge,
  space: getActiveSpace,
  resolveUrl: async(request, refresh) => getMusicUrl({ musicInfo: request.musicInfo, quality: request.quality, isRefresh: refresh, allowToggleSource: false }),
}) : null
let initialized = false
const syncState = { running: false, pending: false, reconcile: false }
const sync = async(reconcile = false): Promise<void> => {
  if (!downloadQueue) return
  if (syncState.running) { syncState.pending = true; syncState.reconcile ||= reconcile; return }
  syncState.running = true
  try { await downloadQueue.sync(reconcile) } finally {
    syncState.running = false
    if (syncState.pending) {
      const reconcileNext = syncState.reconcile
      syncState.pending = false
      syncState.reconcile = false
      void sync(reconcileNext).catch(() => {})
    }
  }
}
export const initDownloads = async(): Promise<void> => {
  if (!downloadQueue || initialized) return
  initialized = true
  new NativeEventEmitter(NativeModules.DownloadModule as NativeModule).addListener('luxDownloadChanged', () => { void sync().catch(() => {}) })
  AppState.addEventListener('change', state => { if (state == 'active') void sync(true).catch(() => {}) })
  onDataSpaceWillChange(downloadQueue.clear)
  onDataSpaceChanged(async() => { await sync(true).catch(() => {}) })
  await sync(true)
}
export const getDownloadedMusicPath = async(song: LX.Music.MusicInfoOnline, quality?: LX.Quality): Promise<string | null> =>
  await downloadQueue?.offline(song, quality) ?? null
export const isIgnoringDownloadBatteryOptimizations = async(): Promise<boolean | null> => await bridge?.batteryStatus() ?? null
export const openDownloadBatterySettings = async(): Promise<boolean> => await bridge?.openBatterySettings() ?? false
