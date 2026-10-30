/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import { LIST_IDS } from '@/config/constant'
import { getListMusics, removeListMusics } from '@/core/list'
import { addDislikeInfo, hasDislike } from '@/core/dislikeList'
import { appendRecommendationQueue } from '@/core/player/player'
import playerState from '@/store/player/state'
import listState from '@/store/list/state'
import { toNewMusicInfo } from '@/utils'
import { onDataSpaceWillChange } from '@/utils/dataSpace'
import { getRadioNext, type Recommendation, type Song } from '@/utils/recommend'
import { sameSong } from '@/utils/recommend/engine'
import { libraryCandidate } from '@/utils/recommend/local'
import { createRadioSession } from './radioSession'

export const playableRecommendation = (item: Recommendation) => item.musicInfo ?? toNewMusicInfo({ ...item.song, types: [], _types: {} })
const songInfo = (song: Song) => toNewMusicInfo({ ...song, types: [], _types: {} })
let radioQueueId: string | null = null
const ownsQueue = () => playerState.playInfo.playerListId == LIST_IDS.TEMP && listState.tempListMeta.id == radioQueueId
export const radioSession = createRadioSession({
  snapshot: async() => {
    const queue = await getListMusics(LIST_IDS.TEMP)
    return {
      active: ownsQueue(),
      index: queue.findIndex(item => item.id == playerState.musicInfo.id),
      songs: queue.map(item => libraryCandidate(item).song),
    }
  },
  next: getRadioNext,
  append: async(items, isCurrent) => appendRecommendationQueue(items.map(playableRecommendation), () => isCurrent() && ownsQueue()),
  writeDislike: async song => addDislikeInfo([{ name: song.name, singer: song.singer }]),
  remove: async(song, isCurrent) => {
    const queue = await getListMusics(LIST_IDS.TEMP)
    if (!isCurrent() || !ownsQueue()) return
    const ids = queue.filter(item => sameSong(libraryCandidate(item).song, song)).map(item => item.id)
    await removeListMusics(LIST_IDS.TEMP, ids)
  },
  isDisliked: song => hasDislike(songInfo(song)),
})

let cleanup: (() => void) | undefined
const check = () => { void radioSession.replenish().catch(() => { /* Retry on the next player event or timer tick. */ }) }
/** Install only for an active session; do not gate events/timer on app visibility. */
export const beginRadioSession = (seed: Song, songs: readonly Song[]) => {
  cleanup?.()
  radioQueueId = listState.tempListMeta.id
  radioSession.start(seed, songs)
  global.state_event.on('playInfoChanged', check)
  global.state_event.on('playerMusicInfoChanged', check)
  global.app_event.on('myListMusicUpdate', check)
  const timer = setInterval(check, 30_000)
  const unsubscribe = radioSession.subscribe(() => {
    if (!radioSession.getState().seed) cleanup?.()
  })
  cleanup = () => {
    global.state_event.off('playInfoChanged', check)
    global.state_event.off('playerMusicInfoChanged', check)
    global.app_event.off('myListMusicUpdate', check)
    clearInterval(timer)
    unsubscribe()
    cleanup = undefined
  }
  check()
}
onDataSpaceWillChange(() => { radioSession.stop(); cleanup?.() })
