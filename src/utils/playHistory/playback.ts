/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { addMusicToQueueAndPlay } from '@/core/player/player'
import listState from '@/store/list/state'
import { getListMusicSync } from '@/utils/listManage'

import { type PlayHistorySong } from './types'

const sameSong = (music: LX.Music.MusicInfo, song: PlayHistorySong): boolean => {
  if (music.source != song.source) return false
  const songmid = String(music.meta?.songId ?? '')
  if (songmid && songmid == song.songmid) return true
  return music.id == song.songmid || music.id == `${song.source}_${song.songmid}`
}

const findKnownMusic = (song: PlayHistorySong): LX.Music.MusicInfo | null => {
  for (const list of listState.allList) {
    const songs = getListMusicSync(list.id)
    for (const music of songs) {
      if (sameSong(music, song)) return music
    }
  }
  return null
}

export const musicFromPlayHistory = (song: PlayHistorySong): LX.Music.MusicInfo => {
  const known = findKnownMusic(song)
  if (known) return known
  if (song.source == 'local') {
    const filePath = song.songmid
    return {
      id: filePath,
      name: song.name,
      singer: song.singer,
      source: 'local',
      interval: song.interval ?? null,
      meta: {
        songId: filePath,
        albumName: song.albumName ?? '',
        picUrl: song.img ?? null,
        filePath,
        ext: /\.(\w+)$/.exec(filePath)?.[1] ?? '',
      },
    }
  }
  const online = {
    id: song.source == 'kg' ? song.songmid : `${song.source}_${song.songmid}`,
    name: song.name,
    singer: song.singer,
    source: song.source,
    interval: song.interval ?? null,
    meta: {
      songId: song.songmid,
      albumName: song.albumName ?? '',
      picUrl: song.img ?? null,
      qualitys: [],
      _qualitys: {},
    },
  }
  return online as LX.Music.MusicInfo
}

export const playHistorySong = async(song: PlayHistorySong): Promise<void> => {
  await addMusicToQueueAndPlay(musicFromPlayHistory(song))
}
