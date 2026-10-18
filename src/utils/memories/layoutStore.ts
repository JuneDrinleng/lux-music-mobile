/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { storageDataPrefix } from '@/config/constant'
import { getData, saveData } from '@/plugins/storage'

import {
  DEFAULT_MEMORIES_LAYOUT,
  normalizeMemoriesLayout,
  type MemoriesLayout,
} from './layout'

/** 本机偏好。不写入上游设置，也不进入同步。 */
const STORAGE_KEY = storageDataPrefix.memoriesLayout

let current: MemoriesLayout = DEFAULT_MEMORIES_LAYOUT
let hydrated = false
const listeners = new Set<(style: MemoriesLayout) => void>()

const emit = () => {
  for (const listener of listeners) listener(current)
}

export const getMemoriesLayout = (): MemoriesLayout => current

export const subscribeMemoriesLayout = (listener: (style: MemoriesLayout) => void): (() => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export const hydrateMemoriesLayout = async(): Promise<MemoriesLayout> => {
  const raw = await getData(STORAGE_KEY).catch(() => null)
  if (!hydrated) {
    current = normalizeMemoriesLayout(raw)
    hydrated = true
    emit()
  }
  return current
}

export const setMemoriesLayout = (value: MemoriesLayout): void => {
  const next = normalizeMemoriesLayout(value)
  current = next
  hydrated = true
  emit()
  void saveData(STORAGE_KEY, next).catch(() => {
    // 选择仍然立即生效，只是这次没能落盘。
  })
}
