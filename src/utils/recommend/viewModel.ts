/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import { type Recommendation, type RecommendationReason } from './types'

export type SimilarTab = 'all' | 'artist' | 'history' | 'similar'
const priority: RecommendationReason[] = ['artist-affinity', 'similar', 'artist', 'chart', 'frequent', 'completed', 'history', 'playlist', 'library']
/** Only render provenance the scorer actually supplied; never infer co-listening. */
export const recommendationReasonKey = (item: Pick<Recommendation, 'reasons'>): string =>
  `recommend_reason_${priority.find(reason => item.reasons.includes(reason)) ?? 'library'}`

export const groupSimilar = (items: readonly Recommendation[]): Record<SimilarTab, Recommendation[]> => ({
  all: [...items],
  artist: items.filter(item => item.reasons.includes('artist-affinity') || item.reasons.includes('artist')),
  history: items.filter(item => item.reasons.some(reason => ['history', 'frequent', 'completed'].includes(reason))),
  similar: items.filter(item => item.reasons.includes('similar')),
})

/** Engine cache owns the daily ordering. The strip must never shuffle or re-score it. */
export const dailyStripItems = (items: readonly Recommendation[]): Recommendation[] => [...items]
