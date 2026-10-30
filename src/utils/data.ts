/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

import { getData, saveData, getAllKeys, removeDataMultiple, saveDataMultiple, removeData, getDataMultiple } from '@/plugins/storage'
import { DEFAULT_SETTING, LIST_IDS, storageDataPrefix, type NAV_ID_Type } from '@/config/constant'
import { luxSpaceId, setActiveSpace, storageKey, getActiveSpace, avatarDirectory, type SpaceId } from './dataSpace'
import { throttle } from './common'
import { existsFile, extname, mkdir, readFile, unlink, writeFile } from './fs'
import { log } from './log'
import { parseMusicUrlRecord, serializeMusicUrlRecord } from './musicUrlCache'
import defaultUserAvatar from '../../assets/img/DefaultAvatar.png'
import AsyncStorage from '@react-native-async-storage/async-storage'
import secureCredentials, { refreshTokenServerKey } from './secureCredentials'
import { migrateLuxCredentials, withoutLuxSecrets } from './secureCredentialMigration'
import { createCredentialStore } from '@/plugins/sync/client/credentials'
// import { gzip, ungzip } from '@/utils/nativeModules/gzip'
// import { readFile, writeFile, temporaryDirectoryPath, unlink } from '@/utils/fs'
// import { isNotificationsEnabled, openNotificationPermissionActivity, shareText } from '@/utils/nativeModules/utils'
// import { i18n } from '@/plugins/i18n'
// import musicSdk from '@/utils/musicSdk'

const fontSizeKey = storageDataPrefix.fontSize
const themeKey = storageDataPrefix.theme
const playInfoStorageKey = storageDataPrefix.playInfo
const userListKey = storageDataPrefix.userList
const viewPrevStateKey = storageDataPrefix.viewPrevState
const listScrollPositionKey = storageDataPrefix.listScrollPosition
const listUpdateInfoKey = storageDataPrefix.listUpdateInfo
const ignoreVersionFailTipTimeKey = storageDataPrefix.ignoreVersionFailTipTimeKey
const searchSettingKey = storageDataPrefix.searchSetting
const searchHistoryListKey = storageDataPrefix.searchHistoryList
const songListSettingKey = storageDataPrefix.songListSetting
const leaderboardSettingKey = storageDataPrefix.leaderboardSetting
const listPrevSelectIdKey = storageDataPrefix.listPrevSelectId
const syncAuthKeyPrefix = storageDataPrefix.syncAuthKey
const syncHostPrefix = storageDataPrefix.syncHost
const syncHostHistoryPrefix = storageDataPrefix.syncHostHistory
const syncModePrefix = storageDataPrefix.syncMode
const luxAuthPrefix = storageDataPrefix.luxAuth
const syncLoginCompletedPrefix = storageDataPrefix.syncLoginCompleted
const syncLoginDraftPrefix = storageDataPrefix.syncLoginDraft
const syncConflictModePrefix = storageDataPrefix.syncConflictMode
const listPrefix = storageDataPrefix.list
const dislikeListPrefix = storageDataPrefix.dislikeList
const userApiPrefix = storageDataPrefix.userApi
const userAvatarPrefix = storageDataPrefix.userAvatar
const userNamePrefix = storageDataPrefix.userName
const userSignaturePrefix = storageDataPrefix.userSignature
const userGenderPrefix = storageDataPrefix.userGender
const openStoragePathPrefix = storageDataPrefix.openStoragePath
const selectedManagedFolderPrefix = storageDataPrefix.selectedManagedFolder

const userAvatarFilePrefix = (space: SpaceId) => `${avatarDirectory(space)}/avatar`
const userAvatarLocalExts = ['jpg', 'jpeg', 'png', 'webp', 'bmp'] as const
const localFileProtocolRxp = /^file:\/\//

export const DEFAULT_USER_AVATAR: number = defaultUserAvatar
export const DEFAULT_USER_NAME = 'Alex Rivera'

const normalizeLocalFilePath = (path: string) => path.replace(localFileProtocolRxp, '')
const isLocalFilePath = (path: string) => path.startsWith('/') || localFileProtocolRxp.test(path)
const isPersistedUserAvatarPath = (path: string, space: SpaceId) => path.startsWith(userAvatarFilePrefix(space) + '.')
const getPersistedUserAvatarPath = (path: string, space: SpaceId) => {
  const targetExt = extname(path).toLowerCase()
  return `${userAvatarFilePrefix(space)}.${userAvatarLocalExts.includes(targetExt as typeof userAvatarLocalExts[number]) ? targetExt : 'png'}`
}
const ensureUserAvatarDir = async(space: SpaceId) => {
  const userAvatarFileDir = avatarDirectory(space)
  if (await existsFile(userAvatarFileDir)) return
  await mkdir(userAvatarFileDir)
}
const clearPersistedUserAvatarFiles = async(space: SpaceId, excludePath?: string) => {
  await Promise.all(userAvatarLocalExts.map(async(ext) => {
    const path = `${userAvatarFilePrefix(space)}.${ext}`
    if (path == excludePath || !await existsFile(path)) return
    await unlink(path).catch(() => {})
  }))
}
const persistUserAvatarPath = async(path: string, space: SpaceId) => {
  const sourcePath = normalizeLocalFilePath(path)
  const targetPath = getPersistedUserAvatarPath(sourcePath, space)
  await ensureUserAvatarDir(space)
  const avatarData = String(await readFile(sourcePath, 'base64'))
  await writeFile(targetPath, avatarData, 'base64')
  await clearPersistedUserAvatarFiles(space, targetPath)
  return targetPath
}
const getUserAvatarDataUrlMime = (path: string) => {
  const ext = extname(path).toLowerCase()
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'webp':
      return 'image/webp'
    case 'bmp':
      return 'image/bmp'
    default:
      return 'image/png'
  }
}
const parseUserAvatarDataUrl = (dataUrl: string) => {
  const result = /^data:(image\/(?:png|jpeg|jpg|webp|bmp));base64,(.+)$/i.exec(dataUrl)
  if (!result) return null
  const mime = result[1].toLowerCase().replace('image/jpg', 'image/jpeg')
  const ext = mime == 'image/jpeg' ? 'jpg' : mime.replace('image/', '')
  return { ext, data: result[2] }
}
const resolveUserAvatar = async(path: string | null, space: SpaceId, key: string) => {
  if (!path) return null
  if (!isLocalFilePath(path)) return path

  const sourcePath = normalizeLocalFilePath(path)
  if (!await existsFile(sourcePath)) {
    await removeData(key)
    return null
  }
  if (isPersistedUserAvatarPath(sourcePath, space)) return sourcePath

  try {
    const persistedPath = await persistUserAvatarPath(sourcePath, space)
    await saveData(key, persistedPath)
    return persistedPath
  } catch (error: any) {
    log.warn('persist user avatar failed:', error?.message ?? error)
    return sourcePath
  }
}

// const defaultListKey = listPrefix + 'default'
// const loveListKey = listPrefix + 'love'

let searchSetting: typeof DEFAULT_SETTING['search']
let songListSetting: typeof DEFAULT_SETTING['songList']
let leaderboardSetting: typeof DEFAULT_SETTING['leaderboard']
let searchHistoryList: string[]

const saveSearchSettingThrottle = throttle(() => {
  void saveData(searchSettingKey, searchSetting)
}, 1000)
const saveSearchHistoryThrottle = throttle(() => {
  void saveData(searchHistoryListKey, searchHistoryList)
}, 1000)
const saveSongListSettingThrottle = throttle(() => {
  void saveData(songListSettingKey, songListSetting)
}, 1000)
const saveLeaderboardSettingThrottle = throttle(() => {
  void saveData(leaderboardSettingKey, leaderboardSetting)
}, 1000)
const saveViewPrevStateThrottle = throttle((state) => {
  void saveData(viewPrevStateKey, state)
}, 1000)

export const getFontSize = async() => (await getData<number>(fontSizeKey) ?? 1)
export const saveFontSize = async(size: number) => {
  await saveData(fontSizeKey, size)
}

export const getUserTheme = async() => (await getData<LX.Theme[]>(themeKey) ?? [])
export const saveUserTheme = async(themes: LX.Theme[]) => {
  await saveData(themeKey, themes)
}


// Capture the physical key before awaiting storage; account switches cannot redirect a write.
const metadataWrites = new Map<string, Promise<void>>()
const updateListMetadata = async<T>(baseKey: string, fallback: T, update: (value: T) => T) => {
  const key = storageKey(baseKey)
  const run = (metadataWrites.get(key) ?? Promise.resolve()).then(async() => {
    const value = await getData<T>(key) ?? fallback
    await saveData(key, update(value))
  })
  metadataWrites.set(key, run.catch(() => {}))
  await run
}
export const getListPosition = async(id: string): Promise<number> => {
  const positions = await getData<LX.List.ListPositionInfo>(listScrollPositionKey) ?? {}
  return positions[id] ?? 0
}
export const saveListPosition = async(id: string, position?: number) => {
  await updateListMetadata<LX.List.ListPositionInfo>(listScrollPositionKey, {}, value => ({ ...value, [id]: position ?? 0 }))
}
export const removeListPosition = async(id: string) => {
  await updateListMetadata<LX.List.ListPositionInfo>(listScrollPositionKey, {}, value => { delete value[id]; return value })
}
export const overwriteListPosition = async(ids: string[]) => {
  await updateListMetadata<LX.List.ListPositionInfo>(listScrollPositionKey, {}, value => Object.fromEntries(Object.entries(value).filter(([id]) => ids.includes(id))))
}
export const getListPrevSelectId = async() => {
  const id = await getData<string>(listPrevSelectIdKey)
  if (!id) return LIST_IDS.DEFAULT
  return id
}
export const saveListPrevSelectId = (id: string) => { void saveData(listPrevSelectIdKey, id) }
export const getListUpdateInfo = async(): Promise<LX.List.ListUpdateInfo> => await getData(listUpdateInfoKey) ?? {}
export const saveListUpdateInfo = async(info: LX.List.ListUpdateInfo) => { await saveData(listUpdateInfoKey, info) }
export const setListAutoUpdate = async(id: string, enable: boolean) => {
  await updateListMetadata<LX.List.ListUpdateInfo>(listUpdateInfoKey, {}, value => ({
    ...value, [id]: { ...(value[id] ?? { updateTime: 0 }), isAutoUpdate: enable },
  }))
}
export const setListUpdateTime = async(id: string, time: number) => {
  await updateListMetadata<LX.List.ListUpdateInfo>(listUpdateInfoKey, {}, value => ({
    ...value, [id]: { ...(value[id] ?? { isAutoUpdate: false }), updateTime: time },
  }))
}
export const removeListUpdateInfo = async(id: string) => {
  await updateListMetadata<LX.List.ListUpdateInfo>(listUpdateInfoKey, {}, value => { delete value[id]; return value })
}
export const overwriteListUpdateInfo = async(ids: string[]) => {
  await updateListMetadata<LX.List.ListUpdateInfo>(listUpdateInfoKey, {}, value => Object.fromEntries(Object.entries(value).filter(([id]) => ids.includes(id))))
}

let ignoreVersionFailTipTime: number | null
export const saveIgnoreVersionFailTipTime = (time: number | null) => {
  ignoreVersionFailTipTime = time
  if (time == null) {
    void removeData(ignoreVersionFailTipTimeKey)
  } else {
    void saveData(ignoreVersionFailTipTimeKey, time)
  }
}
// 获取忽略更新的版本号
export const getIgnoreVersionFailTipTime = async() => {
  // eslint-disable-next-line require-atomic-updates
  if (ignoreVersionFailTipTime === undefined) ignoreVersionFailTipTime = (await getData<number | null>(ignoreVersionFailTipTimeKey))
  return ignoreVersionFailTipTime ?? 0
}

let openStoragePath: string | null = ''
export const saveOpenStoragePath = async(path: string) => {
  if (path) {
    openStoragePath = path
    await saveData(openStoragePathPrefix, path)
  } else {
    if (!openStoragePath) return
    openStoragePath = null
    await removeData(openStoragePathPrefix)
  }
}
// 获取上次打开的存储路径
export const getOpenStoragePath = async() => {
  if (openStoragePath === '') {
    // eslint-disable-next-line require-atomic-updates
    openStoragePath = await getData<string | null>(openStoragePathPrefix)
  }
  return openStoragePath
}

export const getSearchSetting = async() => {
  // eslint-disable-next-line require-atomic-updates
  searchSetting ??= await getData(searchSettingKey) ?? { ...DEFAULT_SETTING.search }
  return { ...searchSetting }
}
export const saveSearchSetting = async(setting: Partial<typeof DEFAULT_SETTING['search']>) => {
  if (!searchSetting) await getSearchSetting()
  let requiredSave = false
  if (setting.source && searchSetting.source != setting.source) requiredSave = true
  if (setting.type && searchSetting.type != setting.type) requiredSave = true
  if (setting.temp_source && searchSetting.temp_source != setting.temp_source) requiredSave = true

  if (!requiredSave) return
  searchSetting = Object.assign(searchSetting, setting)
  saveSearchSettingThrottle()
}

export const getSearchHistory = async() => {
  if (!searchHistoryList) {
    const storedList = await getData<string[]>(searchHistoryListKey) ?? []
    // A save/clear may have populated the cache while the disk read was pending.
    searchHistoryList ??= storedList
  }
  return [...searchHistoryList]
}
export const saveSearchHistory = async(historyList: typeof searchHistoryList) => {
  // if (!searchHistoryList) await getSearchHistory()
  searchHistoryList = historyList
  saveSearchHistoryThrottle()
}

export const getSongListSetting = async() => {
  // eslint-disable-next-line require-atomic-updates
  songListSetting ??= await getData(songListSettingKey) ?? { ...DEFAULT_SETTING.songList }
  return { ...songListSetting }
}
export const saveSongListSetting = async(setting: Partial<typeof DEFAULT_SETTING['songList']>) => {
  if (!songListSetting) await getSongListSetting()
  songListSetting = Object.assign(songListSetting, setting)
  saveSongListSettingThrottle()
}

export const getLeaderboardSetting = async() => {
  // eslint-disable-next-line require-atomic-updates
  leaderboardSetting ??= await getData(leaderboardSettingKey) ?? { ...DEFAULT_SETTING.leaderboard }
  return { ...leaderboardSetting }
}
export const saveLeaderboardSetting = async(setting: Partial<typeof DEFAULT_SETTING['leaderboard']>) => {
  if (!leaderboardSetting) await getLeaderboardSetting()
  leaderboardSetting = Object.assign(leaderboardSetting, setting)
  saveLeaderboardSettingThrottle()
}

export const getViewPrevState = async() => {
  return (await getData<{ id: NAV_ID_Type }>(viewPrevStateKey)) ?? { ...DEFAULT_SETTING.viewPrevState }
}
export const saveViewPrevState = (state: { id: NAV_ID_Type }) => {
  saveViewPrevStateThrottle(state)
}


const idFixRxp = /\.0$/
/**
 * 获取用户列表
 */
export const getUserLists = async(): Promise<LX.List.UserListInfo[]> => {
  const list = await getData<LX.List.UserListInfo[]>(userListKey) ?? []
  for (const info of list) {
    // 兼容v2.3.0之前版本PC端插入数字类型的ID导致其意外在末尾追加 .0 的问题
    if (info.sourceListId?.endsWith?.('.0')) {
      info.sourceListId = info.sourceListId.replace(idFixRxp, '')
    }
  }
  return list
}

/**
 * 保存用户列表
 * @param listInfo
 */
export const saveUserList = async(listInfo: LX.List.UserListInfo[]) => {
  await saveData(userListKey, listInfo)
}

/**
 * 获取列表内歌曲
 * @param listId 列表id
 * @returns
 */
export const getListMusics = async(listId: string): Promise<LX.Music.MusicInfo[]> => {
  const list = await getData<LX.Music.MusicInfo[]>(listPrefix + listId)
  return list ?? []
}

/**
 * 保存列表内歌曲
 * @param listData 列表数据
 */
export const saveListMusics = async(listData: Array<{ id: string, musics: LX.Music.MusicInfo[] }>) => {
  if (listData.length > 1) {
    await saveDataMultiple(listData.map(list => ([listPrefix + list.id, list.musics])))
  } else {
    const list = listData[0]
    await saveData(listPrefix + list.id, list.musics)
  }
}

/**
 * 移除歌曲列表
 * @param ids
 */
export const removeListMusics = async(ids: string[]): Promise<void> => {
  if (ids.length > 1) {
    await removeDataMultiple(ids.map(id => {
      // delete global.lx.listScrollPosition[id]
      // delete global.lx.listSort[id]
      return listPrefix + id
    }))
  } else {
    await removeData(listPrefix + ids[0])
  }
  // await saveData(listSortPrefix, global.lx.listSort)
  // delaySaveListScrollPosition(global.lx.listScrollPosition)
}


export const qualitys: LX.Quality[] = ['128k', '320k', 'flac', 'flac24bit']
export const hasMusicUrlByMusic = async(musicInfo: LX.Music.MusicInfo) => {
  return getDataMultiple(qualitys.map(q => `${storageDataPrefix.musicUrl}${musicInfo.id}_${q}`)).then((urls) => {
    return urls.some(([, url]) => !!url)
  })
}
export const clearMusicUrlByMusic = async(musicInfo: LX.Music.MusicInfo) => {
  await removeDataMultiple(qualitys.map(q => `${storageDataPrefix.musicUrl}${musicInfo.id}_${q}`))
}
export const readMusicUrlRecord = async(musicInfo: LX.Music.MusicInfo, type: LX.Quality) => {
  const raw = await getData(`${storageDataPrefix.musicUrl}${musicInfo.id}_${type}`)
  return parseMusicUrlRecord(raw)
}
export const getMusicUrl = async(musicInfo: LX.Music.MusicInfo, type: LX.Quality) => {
  const record = await readMusicUrlRecord(musicInfo, type)
  return record?.url ?? ''
}
export const saveMusicUrl = async(musicInfo: LX.Music.MusicInfo, type: LX.Quality, url: string) => {
  await saveData(`${storageDataPrefix.musicUrl}${musicInfo.id}_${type}`, serializeMusicUrlRecord(url, Date.now()))
}
export const clearMusicUrl = async(keys?: string[]) => {
  if (!keys) keys = (await getAllKeys()).filter(key => key.startsWith(storageDataPrefix.musicUrl))
  await removeDataMultiple(keys)
}

export const getLyric = async(musicInfo: LX.Music.MusicInfo) => getData<LX.Music.LyricInfo>(`${storageDataPrefix.lyric}${musicInfo.id}`).then(lrcInfo => lrcInfo ?? { lyric: '' })
export const saveLyric = async(musicInfo: LX.Music.MusicInfo, lyricInfo: LX.Music.LyricInfo) => saveData(`${storageDataPrefix.lyric}${musicInfo.id}`, lyricInfo)
export const clearLyric = async(keys?: string[]) => {
  if (!keys) keys = (await getAllKeys()).filter(key => key.startsWith(storageDataPrefix.lyric))
  await removeDataMultiple(keys)
}
export const saveEditedLyric = async(musicInfo: LX.Music.MusicInfo, lyricInfo: LX.Music.LyricInfo) => saveData(`${storageDataPrefix.lyric}${musicInfo.id}_edited`, lyricInfo)
export const clearEditedLyric = async() => {
  let keys = (await getAllKeys()).filter(key => key.startsWith(storageDataPrefix.lyric) && key.endsWith('_edited'))
  await removeDataMultiple(keys)
}
export const getPlayerLyric = async(musicInfo: LX.Music.MusicInfo): Promise<LX.Player.LyricInfo> => {
  return getDataMultiple([
    `${storageDataPrefix.lyric}${musicInfo.id}`,
    `${storageDataPrefix.lyric}${musicInfo.id}_edited`,
  ]).then(([lrcInfo, lrcInfo_edited]) => {
    const lyricInfo: LX.Music.LyricInfo = lrcInfo_edited[1] as LX.Music.LyricInfo | null ?? {
      lyric: '',
    }
    let rawLyricInfo: LX.Music.LyricInfo = lrcInfo[1] as LX.Music.LyricInfo | null ?? {
      lyric: '',
    }
    return lyricInfo.lyric ? {
      ...lyricInfo,
      rawlrcInfo: rawLyricInfo,
    } : {
      ...rawLyricInfo,
      rawlrcInfo: rawLyricInfo,
    }
  })
}

export const getOtherSource = async(id: string) => getData<LX.Music.MusicInfoOnline[]>(`${storageDataPrefix.musicOtherSource}${id}`).then((url) => url ?? [])
export const saveOtherSource = async(id: string, sourceInfo: LX.Music.MusicInfoOnline[]) => saveData(`${storageDataPrefix.musicOtherSource}${id}`, sourceInfo)
export const clearOtherSource = async(keys?: string[]) => {
  if (!keys) keys = (await getAllKeys()).filter(key => key.startsWith(storageDataPrefix.musicOtherSource))
  await removeDataMultiple(keys)
}

/**
 * 获取不喜欢列表信息
 * @returns 不喜欢列表信息
 */
export const getDislikeListRules = async() => {
  return await getData<string>(dislikeListPrefix) ?? ''
}
/**
 * 保存列表信息
 * @param rules 规则信息
 */
export const saveDislikeListRules = async(rules: string) => {
  await saveData(dislikeListPrefix, rules)
}

// export const clearMusicUrlAndLyric = async() => {
//   let keys = (await getAllKeys()).filter(key => key.startsWith(storageDataPrefix.musicUrl) || key.startsWith(storageDataPrefix.lyric))
//   await removeDataMultiple(keys)
// }

export const getMetaCache = async() => {
  const keys = await getAllKeys()
  const info = {
    otherSourceKeys: [] as string[],
    // musicUrlKeys: [] as string[],
    lyricKeys: [] as string[],
  }

  for (const key of keys) {
    if (key.startsWith(storageDataPrefix.musicOtherSource)) info.otherSourceKeys.push(key)
    else if (key.startsWith(storageDataPrefix.lyric)) info.lyricKeys.push(key)
  }

  return info
}

export const savePlayInfo = async(playInfo: LX.Player.SavedPlayInfo) => {
  return saveData(playInfoStorageKey, playInfo)
}
// 获取上次关闭时的当前歌曲播放信息
export const getPlayInfo = async() => {
  return getData<LX.Player.SavedPlayInfo | null>(playInfoStorageKey)
}

let selectedManagedFolder: string | null = ''
export const setSelectedManagedFolder = async(uri: string) => {
  selectedManagedFolder = uri
  return saveData(selectedManagedFolderPrefix, uri)
}
export const getSelectedManagedFolder = async() => {
  if (selectedManagedFolder != '') return selectedManagedFolder
  let uri = await getData<string>(selectedManagedFolderPrefix)
  if (selectedManagedFolder != uri) selectedManagedFolder = uri
  return selectedManagedFolder
}

const syncKeys = createCredentialStore<LX.Sync.KeyInfo>({
  read: async() => getData<Record<string, LX.Sync.KeyInfo>>(syncAuthKeyPrefix),
  // Credentials are small; replace atomically without saveData's remove-before-write gap.
  write: async(keys) => AsyncStorage.setItem(syncAuthKeyPrefix, JSON.stringify(keys)),
  remove: async() => removeData(syncAuthKeyPrefix),
})
export const getSyncAuthKey = async(serverId: string) => syncKeys.get(serverId)
export const setSyncAuthKey = async(serverId: string, info: LX.Sync.KeyInfo) => syncKeys.set(serverId, info)
export const clearSyncAuthKey = async() => syncKeys.clear()

export const getSyncMode = async(): Promise<LX.Sync.Mode> => {
  const mode = await getData<LX.Sync.Mode>(syncModePrefix)
  return mode == 'lux' ? 'lux' : 'lx'
}
export const setSyncMode = async(mode: LX.Sync.Mode) => {
  await saveData(syncModePrefix, mode)
  global.app_event?.syncModeUpdated(mode)
}
let credentialMigration: Promise<void> | undefined
export const migrateStoredLuxCredentials = async() => {
  credentialMigration ??= withLuxAuthWrite(async() => migrateLuxCredentials({
    read: async() => ({ active: await getData<LX.Sync.LuxAuth | null>(luxAuthPrefix), sessions: await getData<Record<string, LX.Sync.LuxAuth>>(storageDataPrefix.luxAuthServers) ?? {} }),
    write: async(active, sessions) => AsyncStorage.multiSet([[luxAuthPrefix, JSON.stringify(active)], [storageDataPrefix.luxAuthServers, JSON.stringify(sessions)]]),
    scrubPasswords: async() => {
      const raw = await getData(syncLoginDraftPrefix)
      if (raw) await AsyncStorage.setItem(syncLoginDraftPrefix, JSON.stringify(normalizeSyncLoginDrafts(raw)))
    },
    mark: async() => AsyncStorage.setItem('@lux_secure_credentials_v1', '1'),
    secure: secureCredentials,
  })).catch(error => { credentialMigration = undefined; throw error })
  return credentialMigration
}
const luxSessions = createCredentialStore<LX.Sync.LuxAuth>({
  read: async() => getData<Record<string, LX.Sync.LuxAuth>>(storageDataPrefix.luxAuthServers),
  write: async(sessions) => AsyncStorage.setItem(storageDataPrefix.luxAuthServers, JSON.stringify(sessions)),
  remove: async() => removeData(storageDataPrefix.luxAuthServers),
})
export const getLuxAuth = async(serverId?: string) => {
  await migrateStoredLuxCredentials()
  await luxAuthWrite
  if (serverId) {
    const session = await luxSessions.get(serverId)
    if (session) return session
  }
  const active = await getData<LX.Sync.LuxAuth | null>(luxAuthPrefix)
  // Accept the old unscoped session once, then bind it when authentication succeeds.
  if (serverId && active?.serverId && active.serverId != serverId) return null
  return active
}
// Serialize all auth mutations, including rotation across different servers.
let luxAuthWrite: Promise<unknown> = Promise.resolve()
const withLuxAuthWrite = async <T>(work: () => Promise<T>): Promise<T> => {
  const next = luxAuthWrite.then(work)
  luxAuthWrite = next.catch(() => {})
  return next
}
export const setLuxAuth = async(auth: LX.Sync.LuxAuth) => {
  await migrateStoredLuxCredentials()
  await withLuxAuthWrite(async() => {
    const input = auth
    auth = withoutLuxSecrets(auth)
    const active = await getData<LX.Sync.LuxAuth | null>(luxAuthPrefix)
    const sessions = await getData<Record<string, LX.Sync.LuxAuth>>(storageDataPrefix.luxAuthServers) ?? {}
    const current = sessions[refreshTokenServerKey(auth)] ?? (auth.serverId ? sessions[auth.serverId] : null) ?? active
    const oldKey = current ? refreshTokenServerKey(current) : null
    const newKey = refreshTokenServerKey(auth)
    const rebinding = current?.token === auth.token && current.user.id === auth.user.id && oldKey !== newKey
    const refreshToken = input.refreshToken ?? (rebinding && oldKey ? await secureCredentials.getRefreshToken(oldKey) : null)
    if (refreshToken) await secureCredentials.setRefreshToken(newKey, refreshToken)
    else if (current?.user.id !== auth.user.id || current.token !== auth.token) await secureCredentials.clear(newKey)
    sessions[newKey] = auth
    if (auth.serverId) sessions[auth.serverId] = auth
    await AsyncStorage.multiSet([[storageDataPrefix.luxAuthServers, JSON.stringify(sessions)], [luxAuthPrefix, JSON.stringify(auth)]])
    if (rebinding && oldKey) await secureCredentials.clear(oldKey)
  })
  if (auth.serverId && auth.user?.id) await setActiveSpace(luxSpaceId(auth.serverId, auth.user.id), auth.user.username, auth.serverUrl)
}
/** Read under the auth mutation lock so account switches cannot lend another user's refresh token. */
export const getLuxRefreshToken = async(previous: LX.Sync.LuxAuth) => {
  await migrateStoredLuxCredentials()
  return withLuxAuthWrite(async() => {
    const sessions = await getData<Record<string, LX.Sync.LuxAuth>>(storageDataPrefix.luxAuthServers) ?? {}
    const active = await getData<LX.Sync.LuxAuth | null>(luxAuthPrefix)
    const current = sessions[refreshTokenServerKey(previous)] ?? (previous.serverId ? sessions[previous.serverId] ?? active : active)
    if (!current || current.token !== previous.token || current.user.id !== previous.user.id || current.serverId !== previous.serverId) return null
    return secureCredentials.getRefreshToken(refreshTokenServerKey(current))
  })
}
export const rotateLuxAuth = async(previous: LX.Sync.LuxAuth, tokens: { token: string, refreshToken: string } & Partial<Pick<LX.Sync.LuxAuth, 'sessionId' | 'accessTokenExpiresAt' | 'user'>>) => {
  await migrateStoredLuxCredentials()
  return withLuxAuthWrite(async() => {
    const sessions = await getData<Record<string, LX.Sync.LuxAuth>>(storageDataPrefix.luxAuthServers) ?? {}
    const active = await getData<LX.Sync.LuxAuth | null>(luxAuthPrefix)
    const current = sessions[refreshTokenServerKey(previous)] ?? (previous.serverId ? sessions[previous.serverId] ?? active : active)
    if (!current || current.token !== previous.token || current.user.id !== previous.user.id || current.serverId !== previous.serverId) return null
    if (!await secureCredentials.setRefreshToken(refreshTokenServerKey(current), tokens.refreshToken)) return null
    const next = withoutLuxSecrets({ ...current, ...tokens })
    sessions[refreshTokenServerKey(next)] = next
    if (next.serverId && sessions[next.serverId]?.user.id === next.user.id) sessions[next.serverId] = next
    const writes: Array<[string, string]> = [[storageDataPrefix.luxAuthServers, JSON.stringify(sessions)]]
    if (active?.token === previous.token && active.user.id === previous.user.id && active.serverId === previous.serverId) writes.push([luxAuthPrefix, JSON.stringify(next)])
    await AsyncStorage.multiSet(writes)
    return next
  })
}
export const clearLuxAuthForServer = async(previous: LX.Sync.LuxAuth) => {
  await migrateStoredLuxCredentials()
  return withLuxAuthWrite(async() => {
    const sessions = await getData<Record<string, LX.Sync.LuxAuth>>(storageDataPrefix.luxAuthServers) ?? {}
    const active = await getData<LX.Sync.LuxAuth | null>(luxAuthPrefix)
    const current = sessions[refreshTokenServerKey(previous)] ?? (previous.serverId ? sessions[previous.serverId] ?? active : active)
    if (!current || current.token !== previous.token || current.user.id !== previous.user.id || current.serverId !== previous.serverId) return false
    await secureCredentials.clear(refreshTokenServerKey(current))
    delete sessions[refreshTokenServerKey(current)]
    if (previous.serverId && sessions[previous.serverId]?.user.id === previous.user.id) delete sessions[previous.serverId]
    const writes: Array<[string, string]> = [[storageDataPrefix.luxAuthServers, JSON.stringify(sessions)]]
    if (active?.token === previous.token && active.serverId === previous.serverId) writes.push([luxAuthPrefix, 'null'])
    await AsyncStorage.multiSet(writes)
    return true
  })
}
export const clearLuxAuth = async() => {
  await migrateStoredLuxCredentials()
  return withLuxAuthWrite(async() => {
    const sessions = await getData<Record<string, LX.Sync.LuxAuth>>(storageDataPrefix.luxAuthServers) ?? {}
    const active = await getData<LX.Sync.LuxAuth | null>(luxAuthPrefix)
    for (const auth of [...Object.values(sessions), ...(active ? [active] : [])]) await secureCredentials.clear(refreshTokenServerKey(auth))
    await AsyncStorage.multiRemove([luxAuthPrefix, storageDataPrefix.luxAuthServers])
  })
}

export const listLuxAuthSessions = async(): Promise<LX.Sync.LuxAuth[]> => {
  await migrateStoredLuxCredentials()
  await luxAuthWrite
  const sessions = await getData<Record<string, LX.Sync.LuxAuth>>(storageDataPrefix.luxAuthServers)
  return [...new Map(Object.values(sessions ?? {}).map(auth => [refreshTokenServerKey(auth), auth])).values()]
}

export const reloadSyncHostFromStorage = async() => {
  let host = await getData<string>(syncHostPrefix) ?? ''
  if (typeof host == 'object') host = ''
  syncHostInfo = host
  return host
}

export const getPreferredSyncHost = async() => {
  const host = (await getSyncHost()).trim()
  if (host) return host
  const history = await getSyncHostHistory()
  return history[0]?.trim() ?? ''
}

export const hasSavedLxSyncKeys = async() => {
  const keys = await getData<Record<string, LX.Sync.KeyInfo>>(syncAuthKeyPrefix)
  if (!keys) return false
  return Object.values(keys).some(key => !key.luxUserId)
}

const normalizeSyncHostUrl = (host: string) => host.trim().replace(/\/+$/, '')

export const findLuxAuthForHost = async(host: string): Promise<LX.Sync.LuxAuth | null> => {
  await migrateStoredLuxCredentials()
  await luxAuthWrite
  const normalized = normalizeSyncHostUrl(host)
  if (!normalized) return null
  const selected = await getData<LX.Sync.LuxAuth | null>(luxAuthPrefix)
  if (selected?.serverUrl && normalizeSyncHostUrl(selected.serverUrl) === normalized) return selected
  const sessions = await getData<Record<string, LX.Sync.LuxAuth>>(storageDataPrefix.luxAuthServers)
  if (sessions) {
    for (const session of Object.values(sessions)) {
      if (session.serverUrl && normalizeSyncHostUrl(session.serverUrl) == normalized) return session
    }
  }
  const active = await getData<LX.Sync.LuxAuth | null>(luxAuthPrefix)
  if (active?.serverUrl && normalizeSyncHostUrl(active.serverUrl) == normalized) return active
  const storedHost = (await getSyncHost()).trim()
  if (active?.user?.username && storedHost && normalizeSyncHostUrl(storedHost) == normalized) return active
  return null
}
const normalizeSyncLoginDrafts = (raw: unknown): LX.Sync.LoginDrafts | null => {
  if (!raw || typeof raw != 'object') return null
  if ('mode' in raw && 'host' in raw) {
    const legacy = raw as LX.Sync.LoginDraft
    if (legacy.mode == 'lux') {
      return {
        lux: {
          host: legacy.host,
          luxUsername: legacy.luxUsername ?? '',
        },
      }
    }
    return {
      lx: {
        host: legacy.host,
        lxAuthCode: legacy.lxAuthCode ?? '',
      },
    }
  }
  const drafts = raw as LX.Sync.LoginDrafts
  return { ...drafts, ...(drafts.lux ? { lux: { host: drafts.lux.host, luxUsername: drafts.lux.luxUsername } } : {}) }
}

export const getSyncLoginDrafts = async() => normalizeSyncLoginDrafts(await getData(syncLoginDraftPrefix))
export const setSyncLoginDrafts = async(drafts: LX.Sync.LoginDrafts) => {
  await AsyncStorage.setItem(syncLoginDraftPrefix, JSON.stringify(normalizeSyncLoginDrafts(drafts)))
}
export const clearSyncLoginDraft = async() => removeData(syncLoginDraftPrefix)

export const getSyncLoginCompleted = async() => getData<boolean>(syncLoginCompletedPrefix).then(completed => completed === true)
export const setSyncLoginCompleted = async(completed: boolean) => {
  await saveData(syncLoginCompletedPrefix, completed)
}
export const getSyncConflictMode = async() => {
  const mode = await getData<LX.Sync.List.SyncMode>(syncConflictModePrefix)
  if (!mode || mode == 'cancel') return null
  // Drop legacy overwrite_* memories so they cannot silently re-apply.
  if (mode.startsWith('overwrite_')) {
    await removeData(syncConflictModePrefix)
    return null
  }
  return mode
}
export const setSyncConflictMode = async(mode: LX.Sync.List.SyncMode) => {
  if (mode == 'cancel') return
  // Never persist overwrite modes — they must be confirmed each time.
  if (mode.startsWith('overwrite_')) return
  await saveData(syncConflictModePrefix, mode)
}
export const clearSyncConflictMode = async() => {
  await removeData(syncConflictModePrefix)
}

let syncHostInfo: string
export const getSyncHost = async() => {
  if (syncHostInfo === undefined) {
    // eslint-disable-next-line require-atomic-updates
    syncHostInfo = await getData(syncHostPrefix) ?? ''

    // 清空1.0.0之前版本的同步主机
    if (typeof syncHostInfo == 'object') syncHostInfo = ''
  }
  return syncHostInfo
}
export const setSyncHost = async(host: string) => {
  // let hostInfo = await getData(syncHostPrefix) || {}
  // hostInfo.host = host
  // hostInfo.port = port
  syncHostInfo = host
  await saveData(syncHostPrefix, syncHostInfo)
}
let syncHostHistory: string[]
export const getSyncHostHistory = async() => {
  if (syncHostHistory === undefined) {
    // eslint-disable-next-line require-atomic-updates
    syncHostHistory = await getData(syncHostHistoryPrefix) ?? []

    // 清空1.0.0之前版本的同步历史
    if (syncHostHistory.length && typeof syncHostHistory[0] !== 'string') syncHostHistory = []
  }
  return syncHostHistory
}
export const addSyncHostHistory = async(host: string) => {
  let syncHostHistory = await getSyncHostHistory()
  if (syncHostHistory.some(h => h == host)) return
  syncHostHistory.unshift(host)
  if (syncHostHistory.length > 20) syncHostHistory = syncHostHistory.slice(0, 20) // 最多存储20个
  await saveData(syncHostHistoryPrefix, syncHostHistory)
}
export const removeSyncHostHistory = async(index: number) => {
  syncHostHistory.splice(index, 1)
  await saveData(syncHostHistoryPrefix, syncHostHistory)
}

let userApis: LX.UserApi.UserApiInfo[] = []
export const getUserApiList = async(): Promise<LX.UserApi.UserApiInfo[]> => {
  userApis = await getData<LX.UserApi.UserApiInfo[]>(userApiPrefix) ?? []

  // 移除 1.7.1 及之前版本的脚本数据被意外存储到列表中的问题
  let updated = false
  for (const info of userApis) {
    if ((info as LX.UserApi.UserApiInfo & { script?: string }).script != null) {
      delete (info as LX.UserApi.UserApiInfo & { script?: string }).script
      updated = true
    }
  }
  if (updated) void saveData(userApiPrefix, userApis)

  return [...userApis]
}
export const getUserApiScript = async(id: string): Promise<string> => {
  const script = await getData<string>(`${userApiPrefix}${id}`) ?? ''
  return script
}

const INFO_NAMES = {
  name: 24,
  description: 36,
  author: 56,
  homepage: 1024,
  version: 36,
} as const
type INFO_NAMES_Type = typeof INFO_NAMES
const matchInfo = (scriptInfo: string) => {
  const infoArr = scriptInfo.split(/\r?\n/)
  const rxp = /^\s?\*\s?@(\w+)\s(.+)$/
  const infos: Partial<Record<keyof typeof INFO_NAMES, string>> = {}
  for (const info of infoArr) {
    const result = rxp.exec(info)
    if (!result) continue
    const key = result[1] as keyof typeof INFO_NAMES
    if (INFO_NAMES[key] == null) continue
    infos[key] = result[2].trim()
  }

  for (const [key, len] of Object.entries(INFO_NAMES) as Array<{ [K in keyof INFO_NAMES_Type]: [K, INFO_NAMES_Type[K]] }[keyof INFO_NAMES_Type]>) {
    infos[key] ||= ''
    if (infos[key] == null) infos[key] = ''
    else if (infos[key].length > len) infos[key] = infos[key].substring(0, len) + '...'
  }

  return infos as Record<keyof typeof INFO_NAMES, string>
}
export const addUserApi = async(script: string): Promise<LX.UserApi.UserApiInfo> => {
  const result = /^\/\*[\S|\s]+?\*\//.exec(script)
  if (!result) throw new Error(global.i18n.t('user_api_add_failed_tip'))

  let scriptInfo = matchInfo(result[0])

  scriptInfo.name ||= `user_api_${new Date().toLocaleString()}`
  const apiInfo: LX.UserApi.UserApiInfo = {
    id: `user_api_${Math.random().toString().substring(2, 5)}_${Date.now()}`,
    ...scriptInfo,
    allowShowUpdateAlert: true,
  }
  userApis.push(apiInfo)
  await saveDataMultiple([
    [userApiPrefix, userApis],
    [`${userApiPrefix}${apiInfo.id}`, script],
  ])
  return apiInfo
}
export const removeUserApi = async(ids: string[]) => {
  if (!userApis) return []
  const _ids: string[] = []
  for (let index = userApis.length - 1; index > -1; index--) {
    if (ids.includes(userApis[index].id)) {
      _ids.push(`${userApiPrefix}${userApis[index].id}`)
      userApis.splice(index, 1)
      ids.splice(index, 1)
    }
  }
  await saveData(userApiPrefix, userApis)
  if (_ids.length) await removeDataMultiple(_ids)
  return [...userApis]
}
export const setUserApiAllowShowUpdateAlert = async(id: string, enable: boolean) => {
  const targetApi = userApis?.find(api => api.id == id)
  if (!targetApi) return
  targetApi.allowShowUpdateAlert = enable
  await saveData(userApiPrefix, userApis)
}

// Capture the space and physical key before any filesystem/storage awaits.
export const getUserAvatar = async() => {
  const space = getActiveSpace()
  const key = storageKey(userAvatarPrefix)
  return resolveUserAvatar(await getData<string>(key) ?? null, space, key)
}
export const saveUserAvatar = async(path: string | null) => {
  const space = getActiveSpace()
  const key = storageKey(userAvatarPrefix)
  if (path) {
    const avatar = isLocalFilePath(path) ? await persistUserAvatarPath(path, space) : path
    await saveData(key, avatar)
    return avatar
  }
  await clearPersistedUserAvatarFiles(space)
  await removeData(key)
  return null
}
export const saveUserAvatarDataUrl = async(dataUrl: string | null) => {
  if (!dataUrl) return saveUserAvatar(null)
  const avatar = parseUserAvatarDataUrl(dataUrl)
  if (!avatar) return saveUserAvatar(dataUrl)
  const space = getActiveSpace()
  const key = storageKey(userAvatarPrefix)
  await ensureUserAvatarDir(space)
  const targetPath = `${userAvatarFilePrefix(space)}.${avatar.ext}`
  await writeFile(targetPath, avatar.data, 'base64')
  await clearPersistedUserAvatarFiles(space, targetPath)
  await saveData(key, targetPath)
  return targetPath
}
export const getUserAvatarDataUrl = async() => {
  const avatar = await getUserAvatar()
  if (!avatar) return ''
  if (!isLocalFilePath(avatar)) return avatar
  const sourcePath = normalizeLocalFilePath(avatar)
  if (!await existsFile(sourcePath)) return ''
  const data = await readFile(sourcePath, 'base64')
  return `data:${getUserAvatarDataUrlMime(sourcePath)};base64,${data}`
}

export const getUserName = async() => {
  return await getData<string>(userNamePrefix) ?? null
}
export const saveUserName = async(name: string | null) => {
  if (name?.trim()) {
    await saveData(userNamePrefix, name)
  } else {
    await removeData(userNamePrefix)
  }
}

export const getUserSignature = async() => {
  return await getData<string>(userSignaturePrefix) ?? null
}
export const saveUserSignature = async(signature: string | null) => {
  if (signature?.trim()) {
    await saveData(userSignaturePrefix, signature)
  } else {
    await removeData(userSignaturePrefix)
  }
}

export const getUserGender = async() => {
  return await getData<'male' | 'female' | 'unknown'>(userGenderPrefix) ?? 'unknown'
}
export const saveUserGender = async(gender: 'male' | 'female' | 'unknown' | null) => {
  if (gender && ['male', 'female', 'unknown'].includes(gender)) {
    await saveData(userGenderPrefix, gender)
  } else {
    await saveData(userGenderPrefix, 'unknown')
  }
}
