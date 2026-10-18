/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import { type PlayHistorySong, type PlayRecord } from '../playHistory/types'

export type Song = PlayHistorySong
export type CandidateOrigin = 'library' | 'history' | 'similar' | 'artist' | 'chart' | 'playlist'
export interface Candidate {
  song: Song
  origin: CandidateOrigin
  /** Retain complete playback metadata whenever the library/SDK provides it. */
  musicInfo?: LX.Music.MusicInfo
}
export type RecommendationReason = CandidateOrigin | 'artist-affinity' | 'frequent' | 'completed'
export interface Recommendation extends Candidate {
  key: string
  score: number
  /** Semantic tokens for the 6.10 UI to translate. No display text in the engine. */
  reasons: RecommendationReason[]
}
export interface RecommendationExposure { song: Song, at: number }
export interface RankOptions {
  now: number
  seed: string
  history: readonly PlayRecord[]
  isDisliked: (song: Song) => boolean
  recommended?: readonly RecommendationExposure[]
  exclude?: readonly Song[]
  anchor?: Song
  limit?: number
  recentPlayMs?: number
  recentRecommendationMs?: number
}
export interface SourceContext {
  spaceId: string
  now: number
  seed: string
  history: readonly PlayRecord[]
  anchor?: Song
}
export interface CandidateSource {
  id: string
  load: (context: SourceContext) => Promise<readonly Candidate[]>
}
