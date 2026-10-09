/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

// Lux Proprietary

import { LIST_IDS, storageDataPrefix } from '@/config/constant'
import { getListMusics, removeListMusics } from '@/core/list'
import { getData, saveData } from '@/plugins/storage'
import listState from '@/store/list/state'
import { buildLocalMusicInfo, buildLocalMusicInfoByFilePath } from '@/screens/Home/Views/Mylist/MyList/listAction'
import { formatPlayTime2 } from '@/utils/common'
import { stat, unlink } from '@/utils/fs'
import { readMetadata, scanAudioFiles } from '@/utils/localMediaMetadata'
import { listDeviceAudio, type DeviceAudioFile } from '@/utils/nativeModules/utils'

const isLocalSong = (song: LX.Music.MusicInfo): song is LX.Music.MusicInfoLocal => song.source == 'local'

const loadLibrary = async(): Promise<LX.Music.MusicInfoLocal[]> => {
  const stored = await getData<LX.Music.MusicInfoLocal[]>(storageDataPrefix.localSongLibrary)
  if (!Array.isArray(stored)) return []
  return stored.filter(isLocalSong)
}

const saveLibrary = async(songs: LX.Music.MusicInfoLocal[]) => {
  await saveData(storageDataPrefix.localSongLibrary, songs)
}

export const addLocalSongs = async(songs: LX.Music.MusicInfoLocal[]) => {
  if (!songs.length) return
  const library = await loadLibrary()
  const byId = new Map(library.map(song => [song.id, song]))
  for (const song of songs) {
    if (song.id) byId.set(song.id, song)
  }
  await saveLibrary([...byId.values()])
}

const musicFromDeviceAudio = (file: DeviceAudioFile): LX.Music.MusicInfoLocal => {
  const display = [file.title, file.displayName, file.path.split('/').pop(), file.path].find(value => Boolean(value?.trim())) ?? file.path
  const dot = display.lastIndexOf('.')
  const name = file.title || (dot > 0 ? display.slice(0, dot) : display)
  const ext = dot > 0 ? display.slice(dot + 1) : ''
  const seconds = file.durationMs > 0 ? file.durationMs / 1000 : 0
  return {
    id: file.path,
    name,
    singer: file.artist && file.artist != '<unknown>' ? file.artist : '',
    source: 'local',
    interval: seconds ? formatPlayTime2(seconds) : null,
    meta: {
      albumName: file.album || '',
      filePath: file.path,
      songId: file.path,
      picUrl: '',
      ext,
    },
  }
}

export const importDeviceAudioLibrary = async() => {
  const files = await listDeviceAudio()
  const songs = files.map(musicFromDeviceAudio)
  await addLocalSongs(songs)
  return songs.length
}

export const importFolderIntoLibrary = async(dirPath: string) => {
  const files = await scanAudioFiles(dirPath)
  const songs: LX.Music.MusicInfoLocal[] = []
  for (const file of files) {
    const meta = await readMetadata(file.path).catch(() => null)
    songs.push(meta ? buildLocalMusicInfo(file.path, meta) : buildLocalMusicInfoByFilePath(file))
  }
  await addLocalSongs(songs)
  return songs.length
}

const listIdsToScan = () => {
  const lists = listState.allList.length
    ? listState.allList
    : [listState.defaultList, listState.loveList, ...listState.userList]
  return lists
    .map(list => list.id)
    .filter(id => id && id != LIST_IDS.TEMP && id != LIST_IDS.DOWNLOAD)
}

export interface DeviceSongRecord {
  musicInfo: LX.Music.MusicInfoLocal
  size: number | null
}

export const collectDeviceSongs = async(): Promise<DeviceSongRecord[]> => {
  const byId = new Map<string, LX.Music.MusicInfoLocal>()
  for (const song of await loadLibrary()) byId.set(song.id, song)
  for (const listId of listIdsToScan()) {
    const songs = await getListMusics(listId)
    for (const song of songs) {
      if (!isLocalSong(song) || !song.id || byId.has(song.id)) continue
      byId.set(song.id, song)
    }
  }
  const records: DeviceSongRecord[] = []
  for (const musicInfo of byId.values()) {
    const info = await stat(musicInfo.meta.filePath).catch(() => null)
    const size = info && typeof info == 'object' && 'size' in info && typeof info.size == 'number' ? info.size : null
    records.push({ musicInfo, size })
  }
  return records
}

/** Remove device songs from the library and from playlists. File deletion is optional. */
export const removeDeviceSongs = async(songs: readonly LX.Music.MusicInfoLocal[], deleteFiles: boolean) => {
  const ids = new Set(songs.map(song => song.id).filter(Boolean))
  if (!ids.size) return
  const library = await loadLibrary()
  await saveLibrary(library.filter(song => !ids.has(song.id)))
  for (const listId of listIdsToScan()) {
    const list = await getListMusics(listId)
    const hit = list.filter(song => isLocalSong(song) && ids.has(song.id)).map(song => song.id)
    if (hit.length) await removeListMusics(listId, hit)
  }
  if (!deleteFiles) return
  for (const song of songs) {
    if (song.meta.filePath) await unlink(song.meta.filePath).catch(() => {})
  }
}
