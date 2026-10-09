/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

// Lux Proprietary

import { LIST_IDS } from '@/config/constant'
import { getListMusics } from '@/core/list'
import listState from '@/store/list/state'
import playerState from '@/store/player/state'
import { rememberAudioCacheEntry, loadAudioCacheIndex } from '@/utils/audioCacheIndex'
import { formatPlayTime, sizeFormate } from '@/utils/common'
import { toNewMusicInfo } from '@/utils'
import { httpFetch } from '@/utils/request'
import { type ParsedAudioCacheKey } from '@/utils/localSongRows'
import { peekPlaylistCover } from '@/utils/playlistCoverStore'
import { getMusicInfo as getKgMusicInfo } from '@/utils/musicSdk/kg/musicInfo'
import { formatSinger } from '@/utils/musicSdk/kw/util'
import { getMusicInfo as getMgMusicInfo } from '@/utils/musicSdk/mg/musicInfo'
import txMusicInfo from '@/utils/musicSdk/tx/musicInfo'
import wyMusicInfo from '@/utils/musicSdk/wy/musicInfo'

const FETCH_TIMEOUT_MS = 8000

export interface CachedSongCatalog {
  userLists: LX.Music.MusicInfo[]
  listenList: LX.Music.MusicInfo[]
  playHistory: LX.Music.MusicInfo[]
  metaStore: LX.Music.MusicInfo[]
  metaByKey: Map<string, LX.Music.MusicInfo>
}

const unwrapPlayMusic = (music: LX.Player.PlayMusic | null | undefined): LX.Music.MusicInfo | null => {
  if (!music) return null
  if ('progress' in music) return music.metadata?.musicInfo ?? null
  return music.id ? music : null
}

export const loadCachedSongCatalog = async(): Promise<CachedSongCatalog> => {
  const lists = listState.allList.length
    ? listState.allList
    : [listState.defaultList, listState.loveList, ...listState.userList]
  const userLists: LX.Music.MusicInfo[] = []
  let listenList: LX.Music.MusicInfo[] = []
  for (const list of lists) {
    if (!list.id || list.id == LIST_IDS.TEMP || list.id == LIST_IDS.DOWNLOAD) continue
    const songs = await getListMusics(list.id).catch(() => [] as LX.Music.MusicInfo[])
    if (list.id == LIST_IDS.DEFAULT) listenList = songs
    else userLists.push(...songs)
  }
  const playHistory: LX.Music.MusicInfo[] = []
  const current = unwrapPlayMusic(playerState.playMusicInfo.musicInfo)
  if (current) playHistory.push(current)
  for (const item of playerState.playedList) {
    const song = unwrapPlayMusic(item.musicInfo)
    if (song) playHistory.push(song)
  }
  for (const item of playerState.tempPlayList) {
    const song = unwrapPlayMusic(item.musicInfo)
    if (song) playHistory.push(song)
  }
  playHistory.push(...await getListMusics(LIST_IDS.TEMP).catch(() => [] as LX.Music.MusicInfo[]))
  const index = await loadAudioCacheIndex()
  return {
    userLists,
    listenList,
    playHistory,
    metaStore: index.map(entry => entry.musicInfo),
    metaByKey: new Map(index.map(entry => [entry.key, entry.musicInfo])),
  }
}

const replaceMeta = <T extends LX.Music.MusicInfo>(song: T, meta: T['meta']): T => {
  return Object.assign({}, song, { meta })
}

export const withCachedCover = (musicInfo: LX.Music.MusicInfo): LX.Music.MusicInfo => {
  if (musicInfo.source == 'local' || musicInfo.meta.picUrl) return musicInfo
  const mapped = peekPlaylistCover(musicInfo.source, musicInfo.id)
  if (!mapped?.url) return musicInfo
  return replaceMeta(musicInfo, { ...musicInfo.meta, picUrl: mapped.url })
}

const withTimeout = async<T>(promise: Promise<T>): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | null = null
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => { reject(new Error('timeout')) }, FETCH_TIMEOUT_MS)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

const onlineQuality = (quality: string): LX.Quality | null => {
  if (quality == '128k' || quality == '320k' || quality == 'flac' || quality == 'flac24bit' || quality == '192k' || quality == 'ape' || quality == 'wav') {
    return quality
  }
  return null
}

const ensureCachedQuality = (musicInfo: LX.Music.MusicInfo, quality: string): LX.Music.MusicInfo => {
  if (musicInfo.source == 'local') return musicInfo
  const type = onlineQuality(quality)
  if (!type || musicInfo.meta._qualitys[type]) return musicInfo
  const hash = musicInfo.source == 'kg' ? musicInfo.meta.hash : null
  const qualityEntry = { type, size: null, ...(hash ? { hash } : {}) }
  return replaceMeta(musicInfo, {
    ...musicInfo.meta,
    qualitys: [...musicInfo.meta.qualitys, qualityEntry],
    _qualitys: {
      ...musicInfo.meta._qualitys,
      [type]: qualityEntry,
    },
  })
}

const singerNames = (singers: unknown) => {
  if (!Array.isArray(singers)) return ''
  const names: string[] = []
  for (const singer of singers) {
    if (!singer || typeof singer != 'object') continue
    const name = (singer as { name?: unknown }).name
    if (typeof name == 'string' && name) names.push(name)
  }
  return names.join('、')
}

const wyQualities = (item: {
  privilege?: { maxbr?: number, maxBrLevel?: string }
  hr?: { size?: number }
  sq?: { size?: number }
  h?: { size?: number }
  l?: { size?: number }
}) => {
  const types: Array<{ type: string, size: string | null }> = []
  const _types: Record<string, { size: string | null }> = {}
  const add = (type: string, file?: { size?: number }) => {
    const size = file?.size ? sizeFormate(file.size) : null
    types.push({ type, size })
    _types[type] = { size }
  }
  const maxbr = item.privilege?.maxbr
  if (item.privilege?.maxBrLevel == 'hires') add('flac24bit', item.hr)
  if (maxbr == 999000) add('flac', item.sq)
  if (maxbr == 999000 || maxbr == 320000) add('320k', item.h)
  if (maxbr == 999000 || maxbr == 320000 || maxbr == 192000 || maxbr == 128000 || maxbr == null) add('128k', item.l)
  if (!types.length) add('128k', item.l)
  return { types: types.reverse(), _types }
}

interface WySongDetail {
  name?: string
  id?: number | string
  dt?: number
  ar?: unknown
  al?: { name?: string, id?: string | number, picUrl?: string | null }
  privilege?: { maxbr?: number, maxBrLevel?: string }
  hr?: { size?: number }
  sq?: { size?: number }
  h?: { size?: number }
  l?: { size?: number }
}

const fetchWy = async(songmid: string) => {
  const item = await wyMusicInfo(songmid).promise as WySongDetail
  if (!item?.name || item.id == null) return null
  const { types, _types } = wyQualities(item)
  return toNewMusicInfo({
    name: item.name,
    singer: singerNames(item.ar),
    source: 'wy',
    songmid: item.id,
    interval: item.dt ? formatPlayTime(item.dt / 1000) : null,
    albumName: item.al?.name ?? '',
    albumId: item.al?.id ?? '',
    img: item.al?.picUrl ?? '',
    types,
    _types,
  })
}

interface KwMusicInfoBody {
  code?: number
  data?: {
    name?: string
    artist?: unknown
    duration?: unknown
    album?: string
    albumid?: string | number
    albumId?: string | number
    pic?: string
    pic120?: string
  }
}

const fetchKw = async(songmid: string) => {
  const { body } = await httpFetch(`http://www.kuwo.cn/api/www/music/musicInfo?mid=${encodeURIComponent(songmid)}`).promise as { body?: KwMusicInfoBody }
  const info = body?.code == 200 ? body.data : null
  if (!info?.name) return null
  const duration = Number(info.duration)
  const seconds = Number.isFinite(duration) ? (duration > 10000 ? duration / 1000 : duration) : 0
  return toNewMusicInfo({
    name: info.name,
    singer: typeof info.artist == 'string' ? formatSinger(info.artist) : '',
    source: 'kw',
    songmid,
    interval: seconds ? formatPlayTime(seconds) : null,
    albumName: info.album ?? '',
    albumId: info.albumid ?? info.albumId ?? '',
    img: info.pic ?? info.pic120 ?? '',
    types: [{ type: '128k', size: null }],
    _types: { '128k': { size: null } },
  })
}

const fetchBySongmid = async(parsed: ParsedAudioCacheKey): Promise<LX.Music.MusicInfo | null> => {
  switch (parsed.source) {
    case 'wy':
      return await fetchWy(parsed.songmid)
    case 'kw':
      return await fetchKw(parsed.songmid)
    case 'tx': {
      const info = await txMusicInfo(parsed.songmid)
      if (!info?.name || !info.songmid) return null
      return toNewMusicInfo(info)
    }
    case 'kg': {
      if (!parsed.hash) return null
      const info = await getKgMusicInfo(parsed.hash)
      if (!info?.name) return null
      return toNewMusicInfo(info)
    }
    case 'mg': {
      const info = await getMgMusicInfo(parsed.songmid)
      if (!info?.name) return null
      return toNewMusicInfo(info)
    }
    default:
      return null
  }
}

const inflight = new Map<string, Promise<LX.Music.MusicInfo | null>>()

/** Ask the source for name, singer, cover and duration when nothing local knows this cache key. */
export const fetchCachedSongMusicInfo = async(parsed: ParsedAudioCacheKey): Promise<LX.Music.MusicInfo | null> => {
  const pending = inflight.get(parsed.cacheKey)
  if (pending) return await pending
  const next = withTimeout(fetchBySongmid(parsed)).then(info => {
    if (!info?.name?.trim() || info.name == parsed.cacheKey) return null
    return ensureCachedQuality(info, parsed.quality)
  }).catch(() => null).finally(() => {
    inflight.delete(parsed.cacheKey)
  })
  inflight.set(parsed.cacheKey, next)
  return await next
}

export const rememberResolvedCacheSong = async(cacheKey: string, musicInfo: LX.Music.MusicInfo) => {
  await rememberAudioCacheEntry(cacheKey, musicInfo)
}
