/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { storageDataPrefix } from '@/config/constant'
import { getData, saveData } from '@/plugins/storage'
import { getActiveSpace, namespacedKey } from '@/utils/dataSpace'
import { isSmartPlaylistDefinition, type SmartPlaylistDefinition } from './model'

interface RuleStorage { version: 1, playlists: SmartPlaylistDefinition[] }
// Rules never enter list metadata, sync payloads or playlist export data.
// Capture the space before any await and serialize mutations per physical key.
const queues = new Map<string, Promise<unknown>>()
const currentKey = () => namespacedKey(storageDataPrefix.smartPlaylistRules, getActiveSpace())
const enqueue = async<T>(key: string, action: () => Promise<T>): Promise<T> => {
  const pending = (queues.get(key) ?? Promise.resolve()).catch(() => {}).then(action)
  queues.set(key, pending)
  try { return await pending } finally { if (queues.get(key) == pending) queues.delete(key) }
}
const read = async(key: string): Promise<RuleStorage> => {
  const stored = await getData<RuleStorage>(key)
  if (stored == null) return { version: 1, playlists: [] }
  if (stored.version != 1 || !Array.isArray(stored.playlists) || !stored.playlists.every(isSmartPlaylistDefinition) ||
    new Set(stored.playlists.map(item => item.playlistId)).size != stored.playlists.length) throw new Error('Invalid smart playlist storage')
  return stored
}
export const loadSmartPlaylistRules = async(): Promise<SmartPlaylistDefinition[]> => {
  const key = currentKey()
  return enqueue(key, async() => (await read(key)).playlists)
}
export const saveSmartPlaylistRule = async(definition: SmartPlaylistDefinition): Promise<void> => {
  if (!isSmartPlaylistDefinition(definition)) throw new Error('Invalid smart playlist definition')
  const key = currentKey()
  const snapshot = JSON.parse(JSON.stringify(definition)) as SmartPlaylistDefinition
  await enqueue(key, async() => {
    const stored = await read(key)
    const index = stored.playlists.findIndex(item => item.playlistId == snapshot.playlistId)
    if (index < 0) stored.playlists.push(snapshot)
    else stored.playlists[index] = snapshot
    await saveData(key, stored)
  })
}
export const removeSmartPlaylistRule = async(playlistId: string): Promise<void> => {
  const key = currentKey()
  await enqueue(key, async() => {
    const stored = await read(key)
    const playlists = stored.playlists.filter(item => item.playlistId != playlistId)
    if (playlists.length != stored.playlists.length) await saveData(key, { version: 1, playlists })
  })
}
