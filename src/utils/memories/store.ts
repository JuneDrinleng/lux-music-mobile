/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { storageDataPrefix } from '@/config/constant'
import { getData, saveData } from '@/plugins/storage'
import { getActiveSpace, namespacedKey } from '@/utils/dataSpace'
import { getPlayRecords } from '../playHistory/store'
import { type PlayRecord } from '../playHistory/types'
import { type TimeZone } from './calendar'
import { emptyMilestoneState, evaluate, type MilestoneState } from './milestones'

// Serialize read/modify/write per captured space; no cache can leak across accounts.
const queues = new Map<string, Promise<unknown>>()
const keyForSpace = () => namespacedKey(storageDataPrefix.memoriesMilestones, getActiveSpace())
const enqueue = async<T>(key: string, action: () => Promise<T>): Promise<T> => {
  const pending = (queues.get(key) ?? Promise.resolve()).catch(() => {}).then(action)
  queues.set(key, pending)
  try { return await pending } finally { if (queues.get(key) == pending) queues.delete(key) }
}
const read = async(key: string): Promise<MilestoneState> => {
  const stored = await getData<MilestoneState>(key)
  if (stored == null) return emptyMilestoneState()
  if (stored.version != 1 || !stored.achieved || typeof stored.achieved != 'object' ||
    Array.isArray(stored.achieved) || !Array.isArray(stored.ignored) || stored.ignored.some(id => typeof id != 'string')) {
    throw new Error('Invalid memories milestone state')
  }
  return stored
}
export const loadMilestoneState = async(): Promise<MilestoneState> => {
  const key = keyForSpace()
  return enqueue(key, async() => read(key))
}
/** Capture active history and storage key before awaiting, including during space switches. */
export const evaluateMilestones = async(history: readonly PlayRecord[] = getPlayRecords(), tz?: TimeZone) => {
  const key = keyForSpace()
  const snapshot = [...history]
  return enqueue(key, async() => {
    const result = evaluate(snapshot, await read(key), tz)
    if (result.newlyReached.length) await saveData(key, result.state)
    return result
  })
}
/** Ignore suppresses future announcements without erasing an achieved timeline entry. */
export const ignoreMilestone = async(id: string): Promise<MilestoneState> => {
  const key = keyForSpace()
  return enqueue(key, async() => {
    const state = await read(key)
    if (!state.ignored.includes(id)) {
      state.ignored.push(id)
      await saveData(key, state)
    }
    return state
  })
}
