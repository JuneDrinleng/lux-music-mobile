/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import { LIST_IDS } from '@/config/constant'
import { getListMusics } from '@/core/list'
import { appendRecommendationQueue, playRecommendationQueue } from '@/core/player/player'
import { libraryCandidate } from '@/utils/recommend/local'
import { getRadioNext, type Recommendation, type Song } from '@/utils/recommend'
import { getActiveSpace } from '@/utils/dataSpace'
import { beginRadioSession, radioSession, playableRecommendation } from './radio'
import { radioTasteParameters } from './radioSession'

export const playRecommendations = async(items: Recommendation[]) => {
  if (!items.length) return
  radioSession.stop()
  await playRecommendationQueue(items.map(playableRecommendation))
}
export const enqueueRecommendations = async(items: Recommendation[]) => appendRecommendationQueue(items.map(playableRecommendation))
export const startRecommendationRadio = async(seed: Song) => {
  const space = getActiveSpace()
  const queue = await getListMusics(LIST_IDS.TEMP)
  const batch = await getRadioNext(seed, queue.map(item => libraryCandidate(item).song), radioTasteParameters('balanced'))
  if (space !== getActiveSpace()) throw new Error('Data space changed during radio request')
  await playRecommendations(batch.items)
  if (batch.items.length && space === getActiveSpace()) beginRadioSession(seed, batch.items.map(item => item.song))
  return batch
}
