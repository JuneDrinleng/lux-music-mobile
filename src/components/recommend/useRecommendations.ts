/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppState } from 'react-native'
import { getDailyRecommendations, getSimilar, type Song } from '@/utils/recommend'
import { createRecommendationLoader, type RecommendationLoadState } from '@/utils/recommend/loadState'
import { onDataSpaceChanged, onDataSpaceWillChange } from '@/utils/dataSpace'

export const useRecommendations = (anchor?: Song) => {
  const [state, setState] = useState<RecommendationLoadState>({ batch: null, loading: true, failed: false })
  const loader = useMemo(() => createRecommendationLoader(setState), [])
  const reload = useCallback(async(retryFailedSources = false) => {
    await loader.load(async onProgress => anchor ? getSimilar(anchor) : getDailyRecommendations({ retryFailedSources, onProgress }))
  }, [anchor, loader])
  useEffect(() => {
    void reload()
    const invalidate = onDataSpaceWillChange(loader.invalidate)
    const changed = onDataSpaceChanged(() => { void reload() })
    const sourceAvailabilityChanged = () => { void reload() }
    global.state_event.on('syncStatusUpdated', sourceAvailabilityChanged)
    let day = new Date().toDateString()
    const refreshDay = () => {
      const next = new Date().toDateString()
      if (!anchor && next !== day) { day = next; void reload() }
    }
    const timer = setInterval(refreshDay, 60_000)
    const appState = AppState.addEventListener('change', state => { if (state === 'active') refreshDay() })
    const cancelRequests = loader.invalidate
    return () => { cancelRequests(); invalidate(); changed(); clearInterval(timer); appState.remove(); global.state_event.off('syncStatusUpdated', sourceAvailabilityChanged) }
  }, [anchor, loader, reload])
  return { ...state, reload }
}
