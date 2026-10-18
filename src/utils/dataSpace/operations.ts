/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import AsyncStorage from '@react-native-async-storage/async-storage'
import { LIST_IDS, storageDataPrefix as keys } from '@/config/constant'
import { getData, saveData } from '@/plugins/storage'
import { existsFile, stat, unlink } from '@/utils/fs'
import { avatarDirectory, copySpaceAvatar } from './avatar'
import { getActiveSpace, isDataSpaceReady, listSpaces, luxSpaceId, namespacedKey, perSpaceKeys, type DataSpace, type SpaceId } from './index'

export interface ImportList { id: string, name: string, count: number }
export interface SpaceContents { lists: ImportList[], songs: number, history: number, bytes: number }
export const decisionKey = (space: SpaceId): string => `dataSpaceImportDecision@${space}`
const read = async<T>(key: string, space: SpaceId): Promise<T | null> => getData<T>(namespacedKey(key, space))

export const readSpaceContents = async(space: SpaceId): Promise<SpaceContents> => {
  const custom = await read<LX.List.UserListInfo[]>(keys.userList, space) ?? []
  const lists: ImportList[] = []
  for (const info of [{ id: LIST_IDS.DEFAULT, name: '' }, { id: LIST_IDS.LOVE, name: '' }, ...custom, { id: LIST_IDS.TEMP, name: '' }]) {
    const songs = await read<unknown[]>(keys.list + info.id, space) ?? []
    // Empty built-ins do not constitute local data or a server playlist.
    if (songs.length || custom.some(list => list.id === info.id)) lists.push({ id: info.id, name: info.name, count: songs.length })
  }
  const history = await read<unknown[]>(keys.playHistory, space) ?? []
  const physical = await spacePhysicalKeys(space)
  const values = await AsyncStorage.multiGet(physical)
  // UTF-8 bytes, including the namespace and shard pointers; no shared audio cache.
  let bytes = values.reduce((sum, [key, value]) => sum + encodeURIComponent(key + (value ?? '')).replace(/%[A-F\d]{2}/g, 'x').length, 0)
  const avatar = await read<string>(keys.userAvatar, space)
  if (avatar?.startsWith(`${avatarDirectory(space)}/avatar.`) && await existsFile(avatar)) bytes += Number((await stat(avatar)).size)
  return { lists, songs: lists.reduce((sum, list) => sum + list.count, 0), history: history.length, bytes }
}

export const ownsSpaceKey = (key: string, space: SpaceId): boolean => {
  if (key.startsWith('@___PART')) return false
  const suffix = `@${space}`
  if (!key.endsWith(suffix)) return false
  const base = key.slice(0, -suffix.length)
  return perSpaceKeys.includes(base) || base.startsWith(keys.list)
}
// Follow published root pointers, never guess ownership from a shard suffix:
// numeric user IDs make e.g. @lux:s:alice20 ambiguous with alice2 + shard 0.
const spacePhysicalKeys = async(space: SpaceId): Promise<string[]> => {
  const roots = (await AsyncStorage.getAllKeys()).filter(key => ownsSpaceKey(key, space))
  const owned = new Set(roots)
  for (const [root, raw] of await AsyncStorage.multiGet(roots)) {
    if (!raw?.startsWith('@___PART_A___')) continue
    const shards = JSON.parse(raw.slice('@___PART_A___'.length)) as string[]
    const prefix = `@___PART_A___${root}`
    for (const shard of shards) {
      if (shard.startsWith(prefix) && /^\d+$/.test(shard.slice(prefix.length))) owned.add(shard)
    }
  }
  return [...owned]
}

export const deleteSpaceData = async(space: SpaceId): Promise<void> => {
  if (space === 'local' || space === getActiveSpace()) throw new Error('Cannot delete active or local space')
  await AsyncStorage.multiRemove(await spacePhysicalKeys(space))
  const directory = avatarDirectory(space)
  if (await existsFile(directory)) await unlink(directory)
  await AsyncStorage.setItem('dataSpaceSpaces', JSON.stringify((await listSpaces()).filter(item => item.id !== space)))
  // Keep the once-per-account decision even when its local data is removed.
}

export interface ImportChoice { ids: string[], history: boolean, all?: boolean }
const mergeById = <T extends { id: string }>(target: T[], source: T[]): T[] => [...target, ...source.filter(item => !target.some(other => other.id === item.id))]
export const copyLocalData = async(space: SpaceId, choice: ImportChoice): Promise<void> => {
  if (!isDataSpaceReady() || space === 'local' || space !== getActiveSpace()) throw new Error('Import account changed')
  const write = async(key: string, value: unknown) => {
    if (space !== getActiveSpace()) throw new Error('Import account changed')
    await saveData(namespacedKey(key, space), value)
  }
  const custom = await read<LX.List.UserListInfo[]>(keys.userList, 'local') ?? []
  const current = await read<LX.List.UserListInfo[]>(keys.userList, space) ?? []
  for (const id of choice.ids) {
    const source = await read<LX.Music.MusicInfo[]>(keys.list + id, 'local') ?? []
    const target = await read<LX.Music.MusicInfo[]>(keys.list + id, space) ?? []
    await write(keys.list + id, mergeById(target, source))
  }
  await write(keys.userList, mergeById(current, custom.filter(item => choice.ids.includes(item.id))))
  if (choice.history) await write(keys.playHistory, mergeById(await read<Array<{ id: string }>>(keys.playHistory, space) ?? [], await read<Array<{ id: string }>>(keys.playHistory, 'local') ?? []))
  if (choice.all) {
    for (const key of [keys.userName, keys.userSignature, keys.userGender, keys.userAvatar]) {
      let value = await read<unknown>(key, 'local')
      if (key === keys.userAvatar && typeof value === 'string') value = await copySpaceAvatar(value, 'local', space)
      if (value != null) await write(key, value)
    }
  }
}

export const prepareLocalImport = async(space: SpaceId, remoteEmpty: () => Promise<boolean>): Promise<SpaceContents | null> => {
  if (!isDataSpaceReady() || space === 'local' || await AsyncStorage.getItem(decisionKey(space))) return null
  const contents = await readSpaceContents('local')
  if (!contents.lists.length && !contents.history) return null
  if (!await remoteEmpty()) return null
  if (space !== getActiveSpace()) throw new Error('Import account changed')
  return contents
}
export const persistImportDecision = async(space: SpaceId): Promise<void> => AsyncStorage.setItem(decisionKey(space), 'decided')

export const spaceHost = (space: DataSpace): string => (space.host ?? '').replace(/^https?:\/\//i, '').replace(/\/+$/, '')
export const switchRoute = (space: DataSpace, session: LX.Sync.LuxAuth | undefined): 'local' | 'session' | 'login' => space.kind === 'local' ? 'local' : session?.token && session.serverId && luxSpaceId(session.serverId, session.user.id) === space.id ? 'session' : 'login'
export const spaceMeta = (space: DataSpace, current: boolean, signedIn: boolean, contents: SpaceContents, t: (key: any, args?: any) => string): string => space.kind === 'local'
  ? t('spaces_local_meta', { count: contents.lists.length, size: `${(contents.bytes / 1024 / 1024).toFixed(1)} MB` })
  : [spaceHost(space), t(signedIn ? 'spaces_signed_in' : 'spaces_signed_out'), current ? t('spaces_using') : ''].filter(Boolean).join(' • ')
