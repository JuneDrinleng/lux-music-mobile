/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import syncState from '@/store/sync/state'
import { usableRecommendationSources } from './availability'
import { storageDataPrefix } from '@/config/constant'
import { hasDislike } from '@/core/dislikeList'
import { getData, saveData } from '@/plugins/storage'
import { toNewMusicInfo } from '@/utils'
import { getActiveSpace, namespacedKey, onDataSpaceWillChange } from '@/utils/dataSpace'
import { getPlayRecords } from '../playHistory/store'
import { localSources } from './local'
import { platformSources } from './platform'
import { createRecommendationEngine, type RecommendationCache } from './service'

// Explicit namespacing captures the space before async I/O, matching memories storage.
const cacheKey = (spaceId: string) => namespacedKey(storageDataPrefix.recommendations, spaceId as ReturnType<typeof getActiveSpace>)
const engine = createRecommendationEngine({
  getSpaceId: getActiveSpace,
  getHistory: getPlayRecords,
  isDisliked: song => hasDislike(toNewMusicInfo({ ...song, types: [], _types: {} })),
  getSources: () => [...localSources(), ...usableRecommendationSources(getActiveSpace(), syncState.status.status, platformSources)],
  readCache: async spaceId => getData<RecommendationCache>(cacheKey(spaceId)),
  writeCache: async(spaceId, cache) => saveData(cacheKey(spaceId), cache),
})

onDataSpaceWillChange(engine.clearSessionCache)

export const { peekDailyRecommendations, getDailyRecommendations, getSimilar, getRadioNext } = engine
export { createRecommendationEngine } from './service'
export type { RecommendationOptions, RecommendationBatch, RecommendationCache, RecommendationDependencies } from './service'
export type { Candidate, CandidateSource, CandidateOrigin, Recommendation, RecommendationReason, Song, SourceContext } from './types'
