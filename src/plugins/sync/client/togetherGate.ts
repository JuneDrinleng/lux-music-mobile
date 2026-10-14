/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { getSyncMode } from '@/utils/data'

import { getReadySyncSocket } from './client'
import { isSyncModuleReady } from './moduleReadys'
import { isTogetherFeatureEnabled } from '../togetherFlag'

export interface TogetherGateSnapshot {
  luxMode: boolean | null
  syncSocketReady: boolean
  featureEnabled: boolean
  moduleReady: boolean
  /** Same predicate as `isTogetherSyncReady()`. */
  rpcReady: boolean
}

/** Read-only gate booleans for listen-together create/join (no side effects). */
export const getTogetherGateSnapshot = async(): Promise<TogetherGateSnapshot> => {
  let luxMode: boolean | null = null
  try {
    luxMode = await getSyncMode() == 'lux'
  } catch {
    luxMode = null
  }
  const socket = getReadySyncSocket()
  const featureEnabled = isTogetherFeatureEnabled()
  const moduleReady = isSyncModuleReady(socket, 'together')
  return {
    luxMode,
    syncSocketReady: socket != null,
    featureEnabled,
    moduleReady,
    rpcReady: featureEnabled && moduleReady,
  }
}
