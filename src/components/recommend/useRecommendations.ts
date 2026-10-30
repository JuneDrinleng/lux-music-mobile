/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppState } from 'react-native'
import { getDailyRecommendations, peekDailyRecommendations, getSimilar, type Song } from '@/utils/recommend'
import { createRecommendationLoader, type RecommendationLoadState } from '@/utils/recommend/loadState'
import { onDataSpaceChanged, onDataSpaceWillChange } from '@/utils/dataSpace'

export const useRecommendations = (anchor?: Song, active = true) => {
  const [state, setState] = useState<RecommendationLoadState>(() => {
    const batch = anchor ? null : peekDailyRecommendations()
    return { batch, loading: !batch, failed: false }
  })
  const loader = useMemo(() => createRecommendationLoader(setState), [])
  const reload = useCallback(async(retryFailedSources = false) => {
    await loader.load(async onProgress => anchor ? getSimilar(anchor) : getDailyRecommendations({ retryFailedSources, onProgress }), anchor ? null : peekDailyRecommendations())
  }, [anchor, loader])
  useEffect(() => {
    const invalidate = onDataSpaceWillChange(loader.invalidate)
    const changed = onDataSpaceChanged(() => { if (active) void reload() })
    const sourceAvailabilityChanged = () => { if (active) void reload() }
    global.state_event.on('syncStatusUpdated', sourceAvailabilityChanged)
    return () => { invalidate(); changed(); global.state_event.off('syncStatusUpdated', sourceAvailabilityChanged) }
  }, [active, loader, reload])
  useEffect(() => () => { loader.invalidate() }, [loader])
  useEffect(() => {
    if (!active) return
    void reload()
    let day = new Date().toDateString()
    const refreshDay = () => {
      const next = new Date().toDateString()
      if (!anchor && next !== day) { day = next; void reload() }
    }
    const timer = setInterval(refreshDay, 60_000)
    const appState = AppState.addEventListener('change', state => { if (state === 'active') refreshDay() })
    return () => { clearInterval(timer); appState.remove() }
  }, [active, anchor, reload])
  return { ...state, reload }
}
