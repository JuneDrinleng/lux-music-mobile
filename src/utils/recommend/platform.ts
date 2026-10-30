/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import musicSdk from '@/utils/musicSdk'
import kgSinger from '@/utils/musicSdk/kg/singer'
import { toNewMusicInfo } from '@/utils'
import { artistNames } from '../memories/onThisDay'
import { seededRandom } from './engine'
import { libraryCandidate } from './local'
import { type Candidate, type CandidateOrigin, type CandidateSource, type SourceContext } from './types'

interface SdkResult { list: Array<Record<string, unknown>> }
/** Only existing public catalog SDK methods. Never invoke user-script playback APIs. */
export interface CatalogSdk {
  musicSearch?: {
    search: (text: string, page: number, limit: number) => Promise<SdkResult>
    musicSearch?: (text: string, page: number, limit: number) => Promise<unknown>
  }
  leaderboard?: {
    getBoards: () => Promise<{ list: Array<{ bangid: string | number }> }>
    getList: (id: string | number, page: number) => Promise<SdkResult>
  }
  songList?: {
    sortList: Array<{ id: string | number }>
    getList: (sort: string | number, tag: string, page: number) => Promise<SdkResult>
    getListDetail: (id: string | number, page?: number) => Promise<SdkResult>
  }
}
const convert = (result: SdkResult, origin: CandidateOrigin): Candidate[] => result.list.slice(0, 60).flatMap(raw => {
  if (typeof raw.name != 'string' || typeof raw.singer != 'string' || raw.songmid == null) return []
  try {
    const candidate = libraryCandidate(toNewMusicInfo({ types: [], _types: {}, ...raw }))
    return [{ ...candidate, origin }]
  } catch { return [] }
})
const anchorFor = (context: SourceContext) => context.anchor ?? [...context.history]
  .filter(record => !record.skipped && record.startedAt <= context.now)
  .sort((a, b) => b.startedAt - a.startedAt)[0]?.song

interface SingerSdk { getSingerSongList: (id: number, page: number, limit: number) => Promise<SdkResult> }
export const platformSources = (catalogs: Record<string, CatalogSdk> = { kw: musicSdk.kw, kg: musicSdk.kg, tx: musicSdk.tx, wy: musicSdk.wy, mg: musicSdk.mg }, singer: SingerSdk = kgSinger): CandidateSource[] => {
  const sources: CandidateSource[] = []
  for (const id of ['kw', 'kg', 'tx', 'wy', 'mg']) {
    const sdk = catalogs[id]
    if (!sdk) continue
    if (sdk.leaderboard) {
      const board = sdk.leaderboard
      sources.push({
        id: `${id}:chart`,
        load: async context => {
          const boards = (await board.getBoards()).list
          const pick = boards[Math.floor(seededRandom(`${context.seed}:${id}:chart`)() * boards.length)]
          return pick ? convert(await board.getList(pick.bangid, 1), 'chart') : []
        },
      })
    }
    if (sdk.songList) {
      const playlists = sdk.songList
      sources.push({
        id: `${id}:playlist`,
        load: async context => {
          const sort = playlists.sortList[0]?.id
          if (sort == null) return []
          const list = (await playlists.getList(sort, '', 1)).list
          const pick = list[Math.floor(seededRandom(`${context.seed}:${id}:playlist`)() * list.length)]
          if (!pick || (typeof pick.id != 'string' && typeof pick.id != 'number')) return []
          // QQ's second argument is a retry counter, unlike other SDKs' page number.
          return convert(await playlists.getListDetail(pick.id, id == 'tx' ? undefined : 1), 'playlist')
        },
      })
    }
    if (sdk.musicSearch) {
      const search = sdk.musicSearch
      if (id == 'kg' && search.musicSearch) {
        sources.push({
          id: 'kg:artist',
          load: async context => {
            const anchor = anchorFor(context)
            const name = anchor && artistNames(anchor.singer)[0]
            if (!name) return []
            // The raw existing search method retains singer IDs discarded by normalized search.
            const raw = await search.musicSearch!(name, 1, 5) as { data?: { lists?: Array<{ Singers?: Array<{ id: number, name: string }> }> } }
            const artist = raw.data?.lists?.flatMap(item => item.Singers ?? [])
              .find(item => item.name.trim().toLocaleLowerCase() == name.trim().toLocaleLowerCase())
            return artist?.id ? convert(await singer.getSingerSongList(artist.id, 1, 30), 'artist') : []
          },
        })
      }
      sources.push({
        id: `${id}:similar`,
        load: async context => {
          const anchor = anchorFor(context)
          if (!anchor) return []
          // Existing SDK has no similarity endpoint: related artist catalog search is a fallback.
          const artist = artistNames(anchor.singer)[0]
          if (!artist) return []
          return convert(await search.search(artist, 1, 30), 'similar')
        },
      })
    }
  }
  return sources
}
