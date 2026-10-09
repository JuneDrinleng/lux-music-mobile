/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { useCallback, useEffect, useMemo, useState } from 'react'

import { storageDataPrefix } from '@/config/constant'
import { useI18n } from '@/lang'
import { getData, saveData } from '@/plugins/storage'
import { getSyncMode } from '@/utils/data'
import { DEFAULT_STATS_CHART_MODE, normalizeStatsChartMode, type StatsChartMode } from '@/utils/playHistory/chartMode'
import { playHistorySong } from '@/utils/playHistory/playback'
import {
  buildRangeStats,
  type PlayRangeId,
} from '@/utils/playHistory/range'
import { getPlayRecords, subscribePlayHistory } from '@/utils/playHistory/store'
import { type PlayHistorySong } from '@/utils/playHistory/types'
import {
  DEFAULT_STATS_PAGE_STYLE,
  type StatsPageStyle,
} from '@/utils/playHistory/statsPageStyle'
import {
  getStatsPageStyle,
  hydrateStatsPageStyle,
  setStatsPageStyle as writeStatsPageStyle,
  subscribeStatsPageStyle,
} from '@/utils/playHistory/statsPageStyleStore'
import { toast } from '@/utils/tools'

const TOP_N = 5

const pad2 = (value: number) => (value < 10 ? `0${value}` : String(value))

export const useStatsPageStylePreference = () => {
  const [style, setStyleState] = useState<StatsPageStyle>(() => getStatsPageStyle())

  useEffect(() => {
    void hydrateStatsPageStyle().then(setStyleState)
    return subscribeStatsPageStyle(setStyleState)
  }, [])

  const setStyle = useCallback((next: StatsPageStyle) => {
    writeStatsPageStyle(next)
  }, [])

  return { style, setStyle, defaultStyle: DEFAULT_STATS_PAGE_STYLE }
}

export const useListeningStatsModel = () => {
  const t = useI18n()
  const [range, setRange] = useState<PlayRangeId>('today')
  const [records, setRecords] = useState(() => getPlayRecords())
  const [now, setNow] = useState(() => Date.now())
  const [luxSync, setLuxSync] = useState(false)
  const [chartMode, setChartMode] = useState<StatsChartMode>(DEFAULT_STATS_CHART_MODE)
  const { style: pageStyle } = useStatsPageStylePreference()

  useEffect(() => subscribePlayHistory(() => {
    setRecords(getPlayRecords())
    setNow(Date.now())
  }), [])

  useEffect(() => {
    const timer = setInterval(() => { setNow(Date.now()) }, 30_000)
    return () => { clearInterval(timer) }
  }, [])

  useEffect(() => {
    let alive = true
    void getSyncMode().then(mode => { if (alive) setLuxSync(mode == 'lux') })
    const onMode = (mode: 'lx' | 'lux') => { if (alive) setLuxSync(mode == 'lux') }
    global.app_event.on('syncModeUpdated', onMode)
    return () => {
      alive = false
      global.app_event.off('syncModeUpdated', onMode)
    }
  }, [])

  useEffect(() => {
    let alive = true
    void getData<unknown>(storageDataPrefix.statsChartMode).then(value => {
      if (alive) setChartMode(normalizeStatsChartMode(value))
    })
    return () => { alive = false }
  }, [])

  const stats = useMemo(() => buildRangeStats(records, range, now), [now, range, records])

  const onChartModeChange = useCallback((value: StatsChartMode) => {
    const next = normalizeStatsChartMode(value)
    setChartMode(next)
    void saveData(storageDataPrefix.statsChartMode, next)
  }, [])

  const durationText = useCallback((ms: number, padMinutes: boolean) => {
    const total = Math.max(0, Math.floor(ms / 60_000))
    const hours = Math.floor(total / 60)
    const minutes = total % 60
    if (hours > 0) return t('stats_duration_hm', { hours, minutes: padMinutes ? pad2(minutes) : minutes })
    return t('stats_duration_m', { minutes })
  }, [t])

  const durationParts = useCallback((ms: number) => {
    const total = Math.max(0, Math.floor(ms / 60_000))
    if (total >= 60) {
      const hours = Math.floor(total / 60)
      const minutes = total % 60
      if (minutes == 0) return { value: String(hours), unit: t('stats_unit_hour') }
      return { value: `${hours}${t('stats_unit_hour')}${minutes}`, unit: t('stats_unit_minute') }
    }
    return { value: String(total), unit: t('stats_unit_minute') }
  }, [t])

  const dateText = useCallback((time: number) => {
    const date = new Date(time)
    return t('stats_date_md', { month: date.getMonth() + 1, day: date.getDate() })
  }, [t])

  const playSong = useCallback((song: PlayHistorySong) => {
    void playHistorySong(song).catch(() => { toast(t('stats_play_fail')) })
  }, [t])

  const songs = useMemo(
    () => stats.songs.slice(0, TOP_N),
    [stats.songs],
  )
  const artists = useMemo(
    () => stats.artists.slice(0, TOP_N),
    [stats.artists],
  )

  const totalMinutes = Math.floor(stats.listenedMs / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  const compareDiffMinutes = useMemo(() => {
    if (range == 'all' || !stats.previousBounds) return null
    return Math.floor(stats.listenedMs / 60_000) - Math.floor(stats.previousListenedMs / 60_000)
  }, [range, stats.listenedMs, stats.previousBounds, stats.previousListenedMs])

  const peakBucket = useMemo(() => {
    if (!stats.chart.length) return null
    return stats.chart.reduce((best, bucket) => (
      bucket.listenedMs > best.listenedMs ? bucket : best
    ))
  }, [stats.chart])

  const dailyAvgMs = stats.dayCount ? stats.listenedMs / stats.dayCount : 0

  return {
    t,
    range,
    setRange,
    records,
    now,
    luxSync,
    chartMode,
    onChartModeChange,
    pageStyle,
    stats,
    songs,
    artists,
    hours,
    minutes,
    totalMinutes,
    compareDiffMinutes,
    peakBucket,
    dailyAvgMs,
    durationText,
    durationParts,
    dateText,
    playSong,
  }
}

export type ListeningStatsModel = ReturnType<typeof useListeningStatsModel>
