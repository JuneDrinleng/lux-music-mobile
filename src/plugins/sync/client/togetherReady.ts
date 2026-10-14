/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { getReadySyncSocket } from './client'
import { isSyncModuleReady, setSyncModuleReady } from './moduleReadys'
import { isTogetherFeatureEnabled, setTogetherFeatureEnabled } from '../togetherFlag'

export { isTogetherRpcNotReadyError } from './moduleReadys'

/** True when Lux sync finished handshake and negotiated listen-together for this socket. */
export const isTogetherSyncReady = (): boolean => {
  if (!isTogetherFeatureEnabled()) return false
  return isSyncModuleReady(getReadySyncSocket(), 'together')
}

/** If together was negotiated but moduleReadys was cleared by reconnect races, restore it. */
export const reconcileTogetherModuleReady = (): void => {
  const socket = getReadySyncSocket()
  if (!socket?.isReady) return
  if (socket.moduleReadys?.together && !isTogetherFeatureEnabled()) {
    setTogetherFeatureEnabled(true)
  }
  if (!isTogetherFeatureEnabled()) return
  if (!isSyncModuleReady(socket, 'together')) setSyncModuleReady(socket, 'together', true)
}
