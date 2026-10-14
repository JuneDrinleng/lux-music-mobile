/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { useEffect, useState } from 'react'

import { onSyncSocketReady } from '@/plugins/sync/client/client'

import { snapshotTogetherGate, type TogetherGateSnapshot } from './togetherGate'
import { syncTogetherConnectionFromSocket } from './index'

const POLL_MS = 800

export const useTogetherGateSnapshot = (active: boolean): TogetherGateSnapshot | null => {
  const [snap, setSnap] = useState<TogetherGateSnapshot | null>(null)

  useEffect(() => {
    if (!active) {
      setSnap(null)
      return
    }
    let cancelled = false
    const refresh = async() => {
      syncTogetherConnectionFromSocket()
      const next = await snapshotTogetherGate()
      if (!cancelled) setSnap(next)
    }
    void refresh()
    const tick = setInterval(() => { void refresh() }, POLL_MS)
    const offReady = onSyncSocketReady(() => { void refresh() })
    return () => {
      cancelled = true
      clearInterval(tick)
      offReady()
    }
  }, [active])

  return snap
}
