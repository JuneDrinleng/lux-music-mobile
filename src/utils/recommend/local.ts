/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import { LIST_IDS } from '@/config/constant'
import { getActiveSpace } from '@/utils/dataSpace'
import { getListMusics, userLists } from '@/utils/listManage'
import { type Candidate, type CandidateSource } from './types'

export const libraryCandidate = (musicInfo: LX.Music.MusicInfo): Candidate => ({
  origin: 'library',
  musicInfo,
  song: {
    source: musicInfo.source,
    songmid: String(musicInfo.meta.songId),
    name: musicInfo.name,
    singer: musicInfo.singer,
    albumName: musicInfo.meta.albumName,
    interval: musicInfo.interval ?? undefined,
    img: musicInfo.meta.picUrl ?? undefined,
  },
})

/** Separate list sources let one corrupt/missing playlist fail without losing the others. */
export const localSources = (): CandidateSource[] => [...new Set([
  LIST_IDS.DEFAULT, LIST_IDS.LOVE, ...userLists.map(list => list.id),
])].map(id => ({
  id: `local:list:${id}`,
  load: async({ spaceId }) => {
    if (spaceId != getActiveSpace()) return []
    const songs = await getListMusics(id)
    if (spaceId != getActiveSpace()) return []
    return songs.slice(0, 300).map(libraryCandidate)
  },
}))
