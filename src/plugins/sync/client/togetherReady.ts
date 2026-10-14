/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { getReadySyncSocket } from './client'
import { isSyncModuleReady } from './moduleReadys'
import { isTogetherFeatureEnabled } from '../togetherFlag'

export { getTogetherGateSnapshot, type TogetherGateSnapshot } from './togetherGate'
export { isTogetherRpcNotReadyError } from './moduleReadys'

/** True when Lux sync finished handshake and negotiated listen-together for this socket. */
export const isTogetherSyncReady = (): boolean => {
  if (!isTogetherFeatureEnabled()) return false
  return isSyncModuleReady(getReadySyncSocket(), 'together')
}
