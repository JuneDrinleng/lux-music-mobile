/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import { type CandidateSource } from './types'

/** Local data space is the existing logged-out/no-server state. A connected Lux
 * space establishes server/auth readiness; SDK method checks establish catalog support.
 * Do not even construct/start remote sources when the session is unavailable. */
export const usableRecommendationSources = (space: string, connected: boolean, sources: () => CandidateSource[]): CandidateSource[] =>
  space != 'local' && connected ? sources() : []
