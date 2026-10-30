/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import AsyncStorage from '@react-native-async-storage/async-storage'
import { storageDataPrefix as keys } from '@/config/constant'
import { log } from '@/utils/log'
import { migrateAvatar } from './avatar'
export { avatarDirectory } from './avatar'

export type SpaceId = 'local' | `lux:${string}:${string}`
export interface DataSpace {
  id: SpaceId
  kind: 'local' | 'lux'
  label?: string
  host?: string
  username?: string
  lastActiveAt: number
}
export const MIGRATION_KEY = 'dataSpaceMigration'
export const BACKUP_KEY = 'dataSpaceBackup@v1'
const ACTIVE_KEY = 'dataSpaceActive'
const SPACES_KEY = 'dataSpaceSpaces'

// Profile fields and avatar files belong to the same space (14D profile editing).
export const perSpaceKeys: readonly string[] = [
  keys.userList, keys.listScrollPosition, keys.listPrevSelectId, keys.listUpdateInfo,
  keys.playInfo, keys.dislikeList, keys.playHistory, keys.playHistoryCursor, keys.memoriesMilestones, keys.recommendations, keys.smartPlaylistRules,
  keys.userAvatar, keys.userName, keys.userSignature, keys.userGender, keys.syncConflictMode,
]
export const isPerSpaceKey = (key: string): boolean =>
  !/@(?:local|lux:.*)$/.test(key) && (perSpaceKeys.includes(key) || key.startsWith(keys.list))

let activeSpace: SpaceId = 'local'
let migrationComplete = false
export const isDataSpaceReady = (): boolean => migrationComplete
const beforeListeners = new Set<() => void>()
const listeners = new Set<() => void | Promise<void>>()
let switching: Promise<void> = Promise.resolve()
export const getActiveSpace = (): SpaceId => activeSpace
export const namespacedKey = (baseKey: string, spaceId = activeSpace): string => `${baseKey}@${spaceId}`
export const storageKey = (baseKey: string): string => migrationComplete && isPerSpaceKey(baseKey) ? namespacedKey(baseKey) : baseKey
export const onDataSpaceWillChange = (listener: () => void): (() => void) => {
  beforeListeners.add(listener)
  return () => { beforeListeners.delete(listener) }
}
export const onDataSpaceChanged = (listener: () => void | Promise<void>): (() => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
export const luxSpaceId = (serverId: string, userId: string): SpaceId => {
  if (!serverId || !userId) throw new Error('Missing Lux data space identity')
  // Escape delimiters so distinct server/account pairs cannot alias.
  return `lux:${encodeURIComponent(serverId)}:${encodeURIComponent(userId)}`
}
const validSpace = (id: string): id is SpaceId => id == 'local' || /^lux:[^:]+:[^:]+$/.test(id)
export const listSpaces = async(): Promise<DataSpace[]> => JSON.parse(await AsyncStorage.getItem(SPACES_KEY) ?? '[]') as DataSpace[]
export const setActiveSpace = async(spaceId: SpaceId, label?: string, host?: string): Promise<void> => {
  if (!validSpace(spaceId)) throw new Error('Invalid data space')
  const run = switching.then(async() => {
    if (!migrationComplete) {
      log.warn('data space switch ignored: migration incomplete', spaceId)
      return
    }
    const spaces = await listSpaces()
    const previous = spaces.find(space => space.id == spaceId)
    const next: DataSpace = { ...previous, id: spaceId, kind: spaceId == 'local' ? 'local' : 'lux', lastActiveAt: Date.now() }
    if (label) { next.label = label; next.username = label }
    if (host) next.host = host
    await AsyncStorage.setItem(SPACES_KEY, JSON.stringify([...spaces.filter(space => space.id != spaceId), next]))
    await AsyncStorage.setItem(ACTIVE_KEY, spaceId)
    if (activeSpace == spaceId) return
    for (const listener of beforeListeners) listener()
    activeSpace = spaceId
    for (const listener of listeners) await listener()
    log.info('data space active:', spaceId)
  })
  switching = run.catch(() => {})
  await run
}

// Raw backup includes the root pointers AND every referenced old/new-format shard.
// Publish manifests/roots last so an interrupted write is never mistaken for a complete copy.
const shardKeys = (value: string): string[] => {
  if (value.startsWith('@___PART_A___')) return JSON.parse(value.slice('@___PART_A___'.length)) as string[]
  if (value.startsWith('@___PART___')) return value.slice('@___PART___'.length).split(',')
  return []
}
interface Backup {
  target: SpaceId
  timestamp: number
  roots: string[]
  entries: Array<[string, string]>
}
const readBackup = async(): Promise<Backup | null> => {
  const manifest = await AsyncStorage.getItem(BACKUP_KEY)
  if (!manifest) return null
  const { chunks } = JSON.parse(manifest) as { chunks: string[] }
  const parts = await AsyncStorage.multiGet(chunks)
  if (parts.some(([, value]) => value == null)) throw new Error('Incomplete data space backup')
  return JSON.parse(parts.map(([, value]) => value).join('')) as Backup
}
const verifyWrite = async(key: string, value: string): Promise<void> => {
  await AsyncStorage.setItem(key, value)
  if (await AsyncStorage.getItem(key) !== value) throw new Error(`Data space verification failed: ${key}`)
}
export const migrateDataSpaces = async(target: SpaceId): Promise<SpaceId> => {
  const marker = await AsyncStorage.getItem(MIGRATION_KEY)
  if (marker && !marker.startsWith('v1:')) throw new Error('Unknown data space migration version')
  if (marker) {
    const target = marker.slice('v1:'.length)
    if (!validSpace(target)) throw new Error('Invalid data space migration target')
    migrationComplete = true
    return target
  }
  const created = new Set<string>()
  const write = async(key: string, value: string, replaceIncompleteChunk = false): Promise<void> => {
    const existing = await AsyncStorage.getItem(key)
    if (existing != null && !replaceIncompleteChunk) {
      if (existing !== value) throw new Error(`Existing migration artifact differs: ${key}`)
      return
    }
    // Track before writing: a rejected native write may still have persisted data.
    if (existing == null) created.add(key)
    await verifyWrite(key, value)
  }
  try {
    log.info('data space migration: begin', target)
    let backup = await readBackup()
    if (!backup) {
      const roots = (await AsyncStorage.getAllKeys()).filter(isPerSpaceKey)
      const entries = new Map<string, string>()
      for (const root of roots) {
        const raw = await AsyncStorage.getItem(root)
        if (raw == null) throw new Error(`Legacy key disappeared: ${root}`)
        entries.set(root, raw)
        for (const shard of shardKeys(raw)) {
          const value = await AsyncStorage.getItem(shard)
          if (value == null) throw new Error(`Missing legacy shard: ${shard}`)
          entries.set(shard, value)
        }
      }
      backup = { target, timestamp: Date.now(), roots, entries: [...entries] }
      const serialized = JSON.stringify(backup)
      const chunks: string[] = []
      for (let offset = 0; offset < serialized.length; offset += 250000) {
        const key = `${BACKUP_KEY}:chunk:${chunks.length}`
        await write(key, serialized.slice(offset, offset + 250000), true)
        chunks.push(key)
      }
      await write(BACKUP_KEY, JSON.stringify({ chunks }))
      if (JSON.stringify(await readBackup()) !== serialized) throw new Error('Backup readback mismatch')
      log.info('data space migration: backup verified', backup.roots.length)
    } else log.info('data space migration: resume verified backup', backup.target)
    // A restart always uses the original backup target, even if credentials changed.
    const entries = new Map(backup.entries)
    for (const root of backup.roots) {
      const destination = namespacedKey(root, backup.target)
      const existing = await AsyncStorage.getItem(destination)
      if (existing != null) {
        for (const shard of shardKeys(existing)) {
          if (await AsyncStorage.getItem(shard) == null) throw new Error(`Incomplete existing destination: ${destination}`)
        }
        log.info('data space migration: keep existing', destination)
        continue
      }
      const raw = entries.get(root)!
      const shards = shardKeys(raw)
      let value = root == keys.userAvatar ? await migrateAvatar(raw, backup.target) : raw
      if (shards.length) {
        const copiedShards: string[] = []
        for (const [index, shard] of shards.entries()) {
          const copied = `@___PART_A___${destination}${index}`
          const part = entries.get(shard)
          if (part == null) throw new Error(`Missing backup shard: ${shard}`)
          await write(copied, part)
          copiedShards.push(copied)
        }
        value = '@___PART_A___' + JSON.stringify(copiedShards)
      }
      await write(destination, value)
      log.info('data space migration: copied and verified', destination)
    }
    await write(MIGRATION_KEY, `v1:${backup.target}`)
    migrationComplete = true
    log.info('data space migration: complete', backup.target)
    return backup.target
  } catch (error) {
    migrationComplete = false
    // Never remove artifacts that predate this attempt or any legacy source.
    for (const key of [...created].reverse()) {
      try { await AsyncStorage.removeItem(key) } catch (cleanupError) { log.warn('data space cleanup failed:', key, cleanupError) }
    }
    log.error('data space migration failed; keeping legacy storage:', error)
    throw error
  }
}

export const initializeDataSpaces = async(): Promise<void> => {
  try {
    // Restore completed routing even if credentials or registry reads later fail.
    if (await AsyncStorage.getItem(MIGRATION_KEY)) activeSpace = await migrateDataSpaces('local')
    // Saved credentials alone do not mean the user is logged in (logout retains them).
    const read = async<T>(key: string): Promise<T | null> => JSON.parse(await AsyncStorage.getItem(key) ?? 'null')
    const [completed, mode, auth, saved] = await Promise.all([
      read<boolean>(keys.syncLoginCompleted), read<string>(keys.syncMode), read<LX.Sync.LuxAuth>(keys.luxAuth), AsyncStorage.getItem(ACTIVE_KEY),
    ])
    let serverId = auth?.serverId
    const loggedIn = completed === true && mode == 'lux' && !!auth?.user?.id
    if (loggedIn && !serverId) {
      const sessions = await read<Record<string, LX.Sync.LuxAuth>>(keys.luxAuthServers)
      serverId = Object.values(sessions ?? {}).find(session => session.user?.id == auth.user.id && session.serverId)?.serverId
      if (!serverId) log.warn('data space identity unknown: using local migration target')
    }
    const account = loggedIn && serverId ? luxSpaceId(serverId, auth.user.id) : null
    const migrated = await migrateDataSpaces(account ?? 'local')
    // Startup has no loaded space caches yet. Registry persistence must not leave
    // completed account data routed to an empty local space if the disk is full.
    activeSpace = account ?? (loggedIn ? 'local' : saved && validSpace(saved) ? saved : migrated)
    await setActiveSpace(activeSpace, account ? auth?.user?.username : undefined)
  } catch (error) {
    log.error('data space initialization failed; continuing startup:', error)
  }
}

export const reloadActiveSpace = async(): Promise<void> => {
  for (const listener of listeners) await listener()
}
