/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import AsyncStorage from '@react-native-async-storage/async-storage'

const STORAGE_KEY = 'lx_cover_failure_registry'
const RETRY_COOLDOWN_MS = 30 * 60 * 1000

interface FailureEntry {
  failedAt: number
  source: LX.OnlineSource
  id: string
  name: string
  singer: string
}

type FailureRegistry = Record<string, FailureEntry>

let registry: FailureRegistry = {}
let loaded = false

const load = async() => {
  if (loaded) return
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (raw) registry = JSON.parse(raw) as FailureRegistry
  } catch {}
  loaded = true
}

const save = async() => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(registry))
  } catch {}
}

export const songKey = (info: { source: LX.OnlineSource, id: string }) =>
  `${info.source}_${info.id}`

export const recordCoverFailure = async(musicInfo: LX.Music.MusicInfoOnline) => {
  await load()
  registry[songKey(musicInfo)] = {
    failedAt: Date.now(),
    source: musicInfo.source,
    id: musicInfo.id,
    name: musicInfo.name,
    singer: musicInfo.singer,
  }
  await save()
}

export const clearCoverFailure = async(musicInfo: { source: LX.OnlineSource, id: string }) => {
  await load()
  delete registry[songKey(musicInfo)]
  await save()
}

export const getFailedEntries = async(): Promise<FailureEntry[]> => {
  await load()
  return Object.values(registry)
}

export const isCoverFailureStale = async(musicInfo: { source: LX.OnlineSource, id: string }): Promise<boolean> => {
  await load()
  const entry = registry[songKey(musicInfo)]
  if (!entry) return false
  return Date.now() - entry.failedAt >= RETRY_COOLDOWN_MS
}
