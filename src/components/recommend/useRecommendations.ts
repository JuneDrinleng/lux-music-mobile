/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { getDailyRecommendations, getSimilar, type RecommendationBatch, type Song } from '@/utils/recommend'
import { onDataSpaceChanged, onDataSpaceWillChange } from '@/utils/dataSpace'

export const useRecommendations = (anchor?: Song) => {
  const [batch, setBatch] = useState<RecommendationBatch | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const generation = useRef(0)
  const reload = useCallback(async(retryFailedSources = false) => {
    const request = ++generation.current
    setLoading(true)
    setFailed(false)
    try {
      const next = await (anchor ? getSimilar(anchor) : getDailyRecommendations({ retryFailedSources }))
      if (request === generation.current) setBatch(next)
    } catch {
      if (request === generation.current) { setFailed(true); setBatch(null) }
    } finally {
      if (request === generation.current) setLoading(false)
    }
  }, [anchor])
  useEffect(() => {
    void reload()
    const invalidate = onDataSpaceWillChange(() => {
      generation.current++
      setBatch(null)
      setLoading(true)
    })
    const changed = onDataSpaceChanged(() => { void reload() })
    let day = new Date().toDateString()
    const refreshDay = () => {
      const next = new Date().toDateString()
      if (!anchor && next !== day) { day = next; void reload() }
    }
    const timer = setInterval(refreshDay, 60_000)
    const appState = AppState.addEventListener('change', state => { if (state === 'active') refreshDay() })
    const cancelRequests = () => { generation.current++ }
    return () => { cancelRequests(); invalidate(); changed(); clearInterval(timer); appState.remove() }
  }, [anchor, reload])
  return { batch, loading, failed, reload }
}
