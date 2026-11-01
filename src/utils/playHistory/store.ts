/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { getActiveSpace, storageKey, onDataSpaceChanged } from '@/utils/dataSpace'
import { storageDataPrefix } from '@/config/constant'
import { getData, saveData } from '@/plugins/storage'

import { isPlayRecord, mergePlayRecords } from './merge'
import { type PlayHistoryCursor, type PlayRecord } from './types'

type Listener = () => void

const listeners = new Set<Listener>()
let records: PlayRecord[] = []
let deviceId = ''
let cursor: PlayHistoryCursor | null = null
let loaded = false
let flushPending: (() => Promise<void>) | null = null
let persistTimer: ReturnType<typeof setTimeout> | null = null

const randomDeviceId = (): string => {
  const alphabet = '0123456789abcdef'
  let id = ''
  for (let index = 0; index < 32; index += 1) id += alphabet[Math.floor(Math.random() * alphabet.length)]
  return id
}

export const subscribePlayHistory = (listener: Listener): (() => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

const notify = () => {
  for (const listener of listeners) listener()
}

const schedulePersist = () => {
  if (persistTimer) clearTimeout(persistTimer)
  const key = storageKey(storageDataPrefix.playHistory)
  const snapshot = records
  flushPending = async() => { await saveData(key, snapshot) }
  persistTimer = setTimeout(() => {
    persistTimer = null
    flushPending = null
    void saveData(key, snapshot)
  }, 400)
}

export const getPlayRecords = (): readonly PlayRecord[] => records

export const getPlayDeviceId = (): string => deviceId

export const getPlayHistoryCursor = (): PlayHistoryCursor | null => cursor

export const loadPlayHistoryStore = async(): Promise<void> => {
  const space = getActiveSpace()
  const [storedRecords, storedDeviceId, storedCursor] = await Promise.all([
    getData<unknown>(storageDataPrefix.playHistory),
    getData<unknown>(storageDataPrefix.playHistoryDevice),
    getData<unknown>(storageDataPrefix.playHistoryCursor),
  ])
  if (space != getActiveSpace()) return
  cursor = null
  records = mergePlayRecords(Array.isArray(storedRecords) ? storedRecords.filter(isPlayRecord) : [])
  if (typeof storedDeviceId == 'string' && storedDeviceId.trim()) {
    deviceId = storedDeviceId
  } else {
    deviceId = randomDeviceId()
    await saveData(storageDataPrefix.playHistoryDevice, deviceId)
  }
  if (storedCursor && typeof storedCursor == 'object') {
    const parsed = storedCursor as PlayHistoryCursor
    const ackedIds = Array.isArray(parsed.ackedIds) ? parsed.ackedIds.filter((id): id is string => typeof id == 'string' && id.length > 0) : []
    if (typeof parsed.serverKey == 'string' && parsed.serverKey.length > 0 &&
      typeof parsed.userId == 'string' &&
      typeof parsed.cursor == 'number' && Number.isSafeInteger(parsed.cursor) && parsed.cursor >= 0) {
      cursor = { serverKey: parsed.serverKey, userId: parsed.userId, cursor: parsed.cursor, ackedIds }
    }
  }
  loaded = true
  notify()
}

export const playHistoryStoreReady = (): boolean => loaded

export const upsertPlayRecord = (record: PlayRecord): void => {
  records = mergePlayRecords(records, [record])
  notify()
  schedulePersist()
}

export const replacePlayRecords = async(next: readonly PlayRecord[]): Promise<void> => {
  records = mergePlayRecords(next)
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  flushPending = null
  await saveData(storageDataPrefix.playHistory, records)
  notify()
}

export const savePlayHistoryCursor = async(next: PlayHistoryCursor): Promise<void> => {
  cursor = next
  await saveData(storageDataPrefix.playHistoryCursor, next)
}

onDataSpaceChanged(async() => {
  const flush = flushPending
  flushPending = null
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  records = []
  cursor = null
  loaded = false
  notify()
  await flush?.()
  await loadPlayHistoryStore()
})

/** The pending closure already owns the source physical key. Await it before routing changes. */
export const flushPlayHistory = async(): Promise<void> => {
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = null
  const pending = flushPending
  await pending?.()
  if (flushPending === pending) flushPending = null
}
