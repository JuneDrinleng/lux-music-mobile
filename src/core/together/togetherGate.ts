/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { getReadySyncSocket } from '@/plugins/sync/client/client'
import { isTogetherSyncReady } from '@/plugins/sync/client/togetherReady'
import { isTogetherFeatureEnabled } from '@/plugins/sync/togetherFlag'
import { getSyncMode } from '@/utils/data'

import { isTogetherDebugPanelBuild } from './debugPanelPreference'

export type TogetherGateSnapshot = {
  mode: LX.Sync.Mode | 'error'
  syncReady: boolean
  feature: boolean
  moduleTogether: boolean
  blocked: 'none' | 'mode' | 'sync' | 'feature' | 'module'
}

export const snapshotTogetherGate = async(): Promise<TogetherGateSnapshot> => {
  let mode: LX.Sync.Mode | 'error' = 'error'
  try {
    mode = await getSyncMode()
  } catch {
    mode = 'error'
  }
  const socket = getReadySyncSocket()
  const feature = isTogetherFeatureEnabled()
  const moduleTogether = Boolean(socket?.moduleReadys?.together)
  let blocked: TogetherGateSnapshot['blocked'] = 'none'
  if (mode != 'lux') blocked = 'mode'
  else if (!socket) blocked = 'sync'
  else if (!feature) blocked = 'feature'
  else if (!moduleTogether) blocked = 'module'
  return {
    mode,
    syncReady: Boolean(socket),
    feature,
    moduleTogether,
    blocked,
  }
}

export const formatTogetherGateHint = (snap: TogetherGateSnapshot): string => (
  `gate mode=${snap.mode} sync=${snap.syncReady ? 1 : 0} feat=${snap.feature ? 1 : 0} mod=${snap.moduleTogether ? 1 : 0} block=${snap.blocked}`
)

export const shouldAppendTogetherGateHint = (): boolean => isTogetherDebugPanelBuild()
