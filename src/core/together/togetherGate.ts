/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { getSession, type SessionState } from '@/plugins/sync/client/session'
import { getSyncMode } from '@/utils/data'

export interface TogetherGateSnapshot {
  sessionId: number | null
  sessionState: SessionState | null
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
  const session = getSession()
  const syncReady = session != null && session.state != 'connecting' && session.state != 'closed'
  const feature = session?.state == 'negotiated' || session?.state == 'togetherReady'
  const moduleTogether = session?.state == 'togetherReady'
  let blocked: TogetherGateSnapshot['blocked'] = 'none'
  if (mode != 'lux') blocked = 'mode'
  else if (!syncReady) blocked = 'sync'
  else if (!feature) blocked = 'feature'
  else if (!moduleTogether) blocked = 'module'
  return {
    mode,
    sessionId: session?.id ?? null,
    sessionState: session?.state ?? null,
    syncReady,
    feature,
    moduleTogether,
    blocked,
  }
}

export const formatTogetherGateHint = (snap: TogetherGateSnapshot): string => (
  `gate session=${snap.sessionId ?? 'none'} state=${snap.sessionState ?? 'none'} mode=${snap.mode} sync=${snap.syncReady ? 1 : 0} feat=${snap.feature ? 1 : 0} mod=${snap.moduleTogether ? 1 : 0} block=${snap.blocked}`
)

/** Always append gate hints on create/join failure until together gate regressions are cleared in the field. */
export const shouldAppendTogetherGateHint = (): boolean => true
