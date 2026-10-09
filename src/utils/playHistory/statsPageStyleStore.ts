/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { storageDataPrefix } from '@/config/constant'
import { getData, saveData } from '@/plugins/storage'

import {
  DEFAULT_STATS_PAGE_STYLE,
  normalizeStatsPageStyle,
  type StatsPageStyle,
} from './statsPageStyle'

/** 本机偏好。不写入上游设置，也不进入同步。 */
const STORAGE_KEY = storageDataPrefix.statsPageStyle

let current: StatsPageStyle = DEFAULT_STATS_PAGE_STYLE
let hydrated = false
const listeners = new Set<(style: StatsPageStyle) => void>()

const emit = () => {
  for (const listener of listeners) listener(current)
}

export const getStatsPageStyle = (): StatsPageStyle => current

export const subscribeStatsPageStyle = (listener: (style: StatsPageStyle) => void): (() => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export const hydrateStatsPageStyle = async(): Promise<StatsPageStyle> => {
  const raw = await getData(STORAGE_KEY).catch(() => null)
  if (!hydrated) {
    current = normalizeStatsPageStyle(raw)
    hydrated = true
    emit()
  }
  return current
}

export const setStatsPageStyle = (value: StatsPageStyle): void => {
  const next = normalizeStatsPageStyle(value)
  current = next
  hydrated = true
  emit()
  void saveData(STORAGE_KEY, next).catch(() => {
    // 选择仍然立即生效，只是这次没能落盘。
  })
}
