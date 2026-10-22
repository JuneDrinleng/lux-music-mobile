/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import { LIST_IDS } from '@/config/constant'
import { getListMusics } from '@/core/list'
import { appendRecommendationQueue, playRecommendationQueue } from '@/core/player/player'
import { toNewMusicInfo } from '@/utils'
import { libraryCandidate } from '@/utils/recommend/local'
import { getRadioNext, type Recommendation, type Song } from '@/utils/recommend'
import { getActiveSpace } from '@/utils/dataSpace'

const playable = (item: Recommendation) => item.musicInfo ?? toNewMusicInfo({ ...item.song, types: [], _types: {} })
export const playRecommendations = async(items: Recommendation[]) => playRecommendationQueue(items.map(playable))
export const enqueueRecommendations = async(items: Recommendation[]) => appendRecommendationQueue(items.map(playable))
export const startRecommendationRadio = async(seed: Song) => {
  const space = getActiveSpace()
  const queue = await getListMusics(LIST_IDS.TEMP)
  const batch = await getRadioNext(seed, queue.map(item => libraryCandidate(item).song))
  if (space !== getActiveSpace()) throw new Error('Data space changed during radio request')
  await playRecommendations(batch.items)
  return batch
}
