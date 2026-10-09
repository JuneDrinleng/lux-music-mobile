/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Animated, ScrollView, TouchableOpacity, View, useWindowDimensions } from 'react-native'
import Svg, { Circle, Line, Polyline } from 'react-native-svg'

import Image from '@/components/common/Image'
import { MdiIcon } from '@/components/common/MdiIcon'
import SegmentedIconSwitch, { type SegmentedIconSwitchItem } from '@/components/common/SegmentedIconSwitch'
import Text from '@/components/common/Text'
import { useOverlaySlideTransition } from '@/components/common/overlaySlideTransition'
import { storageDataPrefix } from '@/config/constant'
import { useI18n } from '@/lang'
import { getData, saveData } from '@/plugins/storage'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { type LuxColors } from '@/theme/luxTokens'
import { useStatusbarHeight } from '@/store/common/hook'
import { getSyncMode } from '@/utils/data'
import { lookupArtistAvatar } from '@/utils/playHistory/artistAvatar'
import { DEFAULT_STATS_CHART_MODE, normalizeStatsChartMode, type StatsChartMode } from '@/utils/playHistory/chartMode'
import { playHistorySong } from '@/utils/playHistory/playback'
import {
  buildRangeStats,
  startOfLocalDay,
  type ChartBucket,
  type PlayRangeId,
  type RankedArtist,
  type RankedSong,
} from '@/utils/playHistory/range'
import { getPlayRecords, subscribePlayHistory } from '@/utils/playHistory/store'
import { type PlayHistorySong } from '@/utils/playHistory/types'
import { scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'
import { createStyle, toast } from '@/utils/tools'
import { useBackHandler } from '@/utils/hooks/useBackHandler'

const RANGES: PlayRangeId[] = ['today', 'days7', 'month', 'year', 'all']
const BAR_MAX = 118

const rangeLabelKey = {
  today: 'stats_range_today',
  days7: 'stats_range_days7',
  month: 'stats_range_month',
  year: 'stats_range_year',
  all: 'stats_range_all',
} as const

const listenLabelKey = {
  today: 'stats_listen_today',
  days7: 'stats_listen_days7',
  month: 'stats_listen_month',
  year: 'stats_listen_year',
  all: 'stats_listen_all',
} as const

const compareKey = {
  today: 'stats_compare_today',
  days7: 'stats_compare_days7',
  month: 'stats_compare_month',
  year: 'stats_compare_year',
} as const

const weekdayKey = [
  'stats_weekday_0',
  'stats_weekday_1',
  'stats_weekday_2',
  'stats_weekday_3',
  'stats_weekday_4',
  'stats_weekday_5',
  'stats_weekday_6',
] as const

const pad2 = (value: number) => (value < 10 ? `0${value}` : String(value))

const useLuxStyles = sharedLuxStyles((colors: LuxColors) => (createStyle({
  root: {
    flex: 1,
    backgroundColor: colors.bg.app,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 34,
  },
  header: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 18,
  },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glass.fill78,
    borderWidth: 1,
    borderColor: colors.glass.backBorder,
  },
  title: {
    flex: 1,
    fontWeight: '700',
  },
  segment: {
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line.segmentAlt,
    backgroundColor: colors.surface.segmentAlt,
    padding: 3,
    marginBottom: 18,
    flexDirection: 'row',
  },
  segmentItem: {
    flex: 1,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segmentItemOn: {
    backgroundColor: colors.surface.card,
    borderColor: colors.line.thumb,
    shadowColor: colors.shadow.segment,
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
  segmentLabel: {
    fontWeight: '600',
  },
  segmentLabelOn: {
    fontWeight: '700',
  },
  card: {
    backgroundColor: colors.surface.card,
    borderRadius: 18,
    marginBottom: 14,
    shadowColor: colors.shadow.card,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  summary: {
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 18,
  },
  eyeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  eyebrow: {
    fontWeight: '700',
    letterSpacing: 1.4,
    flexShrink: 1,
  },
  figures: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  figure: {
    flex: 1,
  },
  figureSplit: {
    width: 112,
    flexGrow: 0,
    flexShrink: 0,
    paddingLeft: 18,
    borderLeftWidth: 1,
    borderLeftColor: colors.line.divider,
  },
  figureLabel: {
    marginBottom: 2,
  },
  figureValue: {
    fontWeight: '700',
    lineHeight: 38,
    letterSpacing: -0.3,
  },
  figureUnit: {
    fontWeight: '600',
    letterSpacing: 0,
    marginLeft: 2,
    marginRight: 4,
  },
  compare: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line.divider,
  },
  pill: {
    height: 24,
    paddingLeft: 6,
    paddingRight: 10,
    borderRadius: 999,
    backgroundColor: colors.accent.soft,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pillText: {
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 10,
    paddingLeft: 4,
  },
  sectionTitle: {
    fontWeight: '700',
  },
  sectionLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionLinkText: {
    fontWeight: '600',
  },
  chartBlock: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.line.divider,
  },
  chartToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  chartUnit: {
    fontWeight: '600',
  },
  chartArea: {
    height: 176,
  },
  bars: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    minWidth: 0,
  },
  barValue: {
    height: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  bar: {
    width: 10,
    borderRadius: 5,
    backgroundColor: colors.surface.segment,
  },
  barToday: {
    backgroundColor: colors.accent.primary,
  },
  barEmpty: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.line.divider,
  },
  dayLabel: {
    marginTop: 8,
    height: 18,
    textAlign: 'center',
  },
  dayLabelToday: {
    backgroundColor: colors.accent.primary,
    color: colors.ink.onAccent,
    fontWeight: '700',
    paddingHorizontal: 5,
    borderRadius: 9,
    overflow: 'hidden',
  },
  lineWrap: {
    flex: 1,
  },
  list: {
    paddingVertical: 4,
  },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  rank: {
    width: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginRight: 10,
  },
  cover: {
    width: 44,
    height: 44,
    borderRadius: 12,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  coverImage: {
    width: 44,
    height: 44,
    borderRadius: 12,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  songTitle: {
    fontWeight: '700',
  },
  artistTitle: {
    fontWeight: '700',
  },
  songSub: {
    marginTop: 3,
  },
  artistSub: {
    marginTop: 2,
  },
  count: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginLeft: 10,
    gap: 2,
  },
  countValue: {
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: colors.line.divider,
    marginLeft: 96,
    marginRight: 16,
  },
  avatarOuter: {
    width: 44,
    height: 44,
    borderRadius: 22,
    padding: 2,
    marginRight: 12,
    backgroundColor: colors.surface.card,
    shadowColor: colors.shadow.ink,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  avatarInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface.avatar,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  empty: {
    paddingVertical: 22,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  footnote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingTop: 4,
    paddingHorizontal: 4,
  },
  footnoteText: {
    flex: 1,
    lineHeight: 18,
  },
})))

export interface ListeningStatsPageProps {
  onClose: () => void
  bottomPadding?: number
}

const ArtistFace = ({ name, fallback }: { name: string, fallback?: string }) => {
  const styles = useLuxStyles()
  const { colors } = useLuxTheme()
  const [url, setUrl] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    let alive = true
    void lookupArtistAvatar(name).then(found => {
      if (alive) setUrl(found)
    })
    return () => { alive = false }
  }, [name])
  const src = url ?? fallback
  return (
    <View style={styles.avatarOuter}>
      <View style={styles.avatarInner}>
        {src
          ? <Image style={styles.avatarImage} url={src} />
          : <MdiIcon name="account" size={22} color={colors.ink.quiet} />}
      </View>
    </View>
  )
}

const bucketLabel = (
  bucket: ChartBucket,
  range: PlayRangeId,
  t: (key: string, params?: Record<string, string | number>) => string,
): { text: string, highlight: boolean, show: boolean } => {
  if (bucket.kind == 'hour2') {
    const show = bucket.hour % 6 == 0
    return {
      text: show ? t('stats_hour_label', { hour: bucket.hour }) : '',
      highlight: bucket.isCurrent,
      show,
    }
  }
  if (bucket.kind == 'day') {
    if (range == 'days7') {
      return {
        text: bucket.isCurrent ? t('stats_today') : t(weekdayKey[bucket.weekday]),
        highlight: bucket.isCurrent,
        show: true,
      }
    }
    return {
      text: String(bucket.dayOfMonth),
      highlight: bucket.isCurrent,
      show: bucket.isCurrent || bucket.dayOfMonth == 1 || bucket.dayOfMonth % 5 == 0,
    }
  }
  if (bucket.kind == 'month') {
    return {
      text: t('stats_month_label', { month: bucket.month + 1 }),
      highlight: bucket.isCurrent,
      show: true,
    }
  }
  return {
    text: String(bucket.year),
    highlight: bucket.isCurrent,
    show: true,
  }
}

const ListeningChart = ({
  buckets,
  range,
  mode,
  styles,
  colors,
  t,
}: {
  buckets: ChartBucket[]
  range: PlayRangeId
  mode: StatsChartMode
  styles: ReturnType<typeof useLuxStyles>
  colors: LuxColors
  t: (key: string, params?: Record<string, string | number>) => string
}) => {
  const maxMinutes = buckets.reduce((max, bucket) => Math.max(max, bucket.minutes), 0)
  const plotHeight = scaleSizeH(118)
  const labelReserve = scaleSizeH(28)
  const width = Math.max(scaleSizeW(280), buckets.length * scaleSizeW(18))

  if (mode == 'line') {
    const points = buckets.map((bucket, index) => {
      const x = buckets.length <= 1 ? width / 2 : (index / (buckets.length - 1)) * (width - 8) + 4
      const ratio = maxMinutes <= 0 || bucket.minutes <= 0 ? 0 : bucket.minutes / maxMinutes
      const y = plotHeight - ratio * (plotHeight - 10) - 6
      return { x, y, bucket }
    })
    const polyline = points.map(point => `${point.x},${point.y}`).join(' ')
    return (
      <View style={styles.chartArea}>
        <View style={styles.lineWrap}>
          <Svg width="100%" height={plotHeight} viewBox={`0 0 ${width} ${plotHeight}`} preserveAspectRatio="none">
            <Line
              x1={4}
              y1={plotHeight - 1}
              x2={width - 4}
              y2={plotHeight - 1}
              stroke={colors.line.divider}
              strokeWidth={1}
            />
            {polyline
              ? <Polyline points={polyline} fill="none" stroke={colors.accent.primary} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
              : null}
            {points.map(point => (
              <Circle
                key={point.bucket.start}
                cx={point.x}
                cy={point.y}
                r={point.bucket.isCurrent ? 4.5 : 3.2}
                fill={point.bucket.isCurrent ? colors.accent.primary : colors.surface.card}
                stroke={colors.accent.primary}
                strokeWidth={point.bucket.isCurrent ? 0 : 2}
              />
            ))}
          </Svg>
          <View style={[styles.bars, { height: labelReserve, alignItems: 'flex-start' }]}>
            {buckets.map(bucket => {
              const label = bucketLabel(bucket, range, t)
              return (
                <View key={bucket.start} style={styles.barColumn}>
                  {label.show
                    ? (
                      <Text
                        size={10}
                        color={label.highlight ? colors.ink.onAccent : colors.ink.faint}
                        style={[styles.dayLabel, label.highlight ? styles.dayLabelToday : null]}
                        numberOfLines={1}
                      >{label.text}</Text>
                      )
                    : <Text size={10} color={colors.ink.faint} style={styles.dayLabel}> </Text>}
                </View>
              )
            })}
          </View>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.chartArea}>
      <View style={styles.bars}>
        {buckets.map(bucket => {
          const empty = bucket.minutes <= 0
          const height = empty || maxMinutes <= 0 ? 4 : Math.max(4, Math.round(bucket.minutes / maxMinutes * BAR_MAX))
          const label = bucketLabel(bucket, range, t)
          return (
            <View key={bucket.start} style={styles.barColumn}>
              <Text size={10} color={bucket.isCurrent ? colors.ink.strong : colors.ink.meta} style={styles.barValue}>
                {empty || buckets.length > 14 ? ' ' : String(bucket.minutes)}
              </Text>
              <View style={[styles.bar, empty ? styles.barEmpty : bucket.isCurrent ? styles.barToday : null, { height: scaleSizeH(height) }]} />
              {label.show
                ? (
                  <Text
                    size={10}
                    color={label.highlight ? colors.ink.onAccent : colors.ink.faint}
                    style={[styles.dayLabel, label.highlight ? styles.dayLabelToday : null]}
                    numberOfLines={1}
                  >{label.text}</Text>
                  )
                : <Text size={10} color={colors.ink.faint} style={styles.dayLabel}> </Text>}
            </View>
          )
        })}
      </View>
    </View>
  )
}

const ListeningStatsPage = ({ onClose, bottomPadding = 0 }: ListeningStatsPageProps) => {
  const styles = useLuxStyles()
  const { colors } = useLuxTheme()
  const t = useI18n()
  const statusBarHeight = useStatusbarHeight()
  const { width } = useWindowDimensions()
  const { style: sceneStyle, requestClose: animateClose } = useOverlaySlideTransition(width)
  const [range, setRange] = useState<PlayRangeId>('days7')
  const [listMode, setListMode] = useState<null | 'songs' | 'artists'>(null)
  const [records, setRecords] = useState(() => getPlayRecords())
  const [now, setNow] = useState(() => Date.now())
  const [luxSync, setLuxSync] = useState(false)
  const [chartMode, setChartMode] = useState<StatsChartMode>(DEFAULT_STATS_CHART_MODE)

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

  const chartSwitchItems = useMemo<SegmentedIconSwitchItem[]>(() => [
    {
      key: 'bar',
      accessibilityLabel: t('stats_chart_bar'),
      renderIcon: (active) => (
        <MdiIcon name="chart-bar" rawSize={16} color={active ? colors.ink.strong : colors.ink.chipIdle} />
      ),
    },
    {
      key: 'line',
      accessibilityLabel: t('stats_chart_line'),
      renderIcon: (active) => (
        <MdiIcon name="chart-line" rawSize={16} color={active ? colors.ink.strong : colors.ink.chipIdle} />
      ),
    },
  ], [colors.ink.chipIdle, colors.ink.strong, t])

  const onChartModeChange = useCallback((value: string) => {
    const next = normalizeStatsChartMode(value)
    setChartMode(next)
    void saveData(storageDataPrefix.statsChartMode, next)
  }, [])

  const requestClose = useCallback(() => {
    if (listMode) {
      setListMode(null)
      return
    }
    animateClose(onClose)
  }, [animateClose, listMode, onClose])

  useBackHandler(useCallback(() => {
    requestClose()
    return true
  }, [requestClose]))

  const durationText = useCallback((ms: number, padMinutes: boolean) => {
    const total = Math.max(0, Math.floor(ms / 60_000))
    const hours = Math.floor(total / 60)
    const minutes = total % 60
    if (hours > 0) return t('stats_duration_hm', { hours, minutes: padMinutes ? pad2(minutes) : minutes })
    return t('stats_duration_m', { minutes })
  }, [t])

  const dateText = useCallback((time: number) => {
    const date = new Date(time)
    return t('stats_date_md', { month: date.getMonth() + 1, day: date.getDate() })
  }, [t])

  const rangeText = useMemo(() => {
    const endDay = startOfLocalDay(stats.bounds.end - 1)
    if (stats.bounds.start == null) {
      if (!records.length) return t('stats_range_all')
      const earliest = records.reduce((min, record) => Math.min(min, record.startedAt), now)
      return t('stats_date_span', { start: dateText(earliest), end: dateText(endDay) })
    }
    const startDay = startOfLocalDay(stats.bounds.start)
    if (startDay == endDay) return dateText(startDay)
    return t('stats_date_span', { start: dateText(startDay), end: dateText(endDay) })
  }, [dateText, now, records, stats.bounds.end, stats.bounds.start, t])

  const compareText = useMemo(() => {
    if (range == 'all' || !stats.previousBounds) return null
    const key = compareKey[range]
    const current = Math.floor(stats.listenedMs / 60_000)
    const previous = Math.floor(stats.previousListenedMs / 60_000)
    const diff = current - previous
    const delta = diff == 0
      ? t('stats_compare_flat')
      : `${diff > 0 ? '+' : '-'}${durationText(Math.abs(diff) * 60_000, true)}`
    return t(key, { delta })
  }, [durationText, range, stats.listenedMs, stats.previousBounds, stats.previousListenedMs, t])

  const playSong = useCallback((song: PlayHistorySong) => {
    void playHistorySong(song).catch(() => { toast(t('stats_play_fail')) })
  }, [t])

  const hours = Math.floor(Math.floor(stats.listenedMs / 60_000) / 60)
  const minutes = Math.floor(stats.listenedMs / 60_000) % 60
  const title = listMode == 'songs' ? t('stats_all_songs') : listMode == 'artists' ? t('stats_all_artists') : t('stats_title')
  const songs = listMode == 'songs' ? stats.songs : stats.songs.slice(0, 5)
  const artists = listMode == 'artists' ? stats.artists : stats.artists.slice(0, 5)

  return (
    <Animated.View style={[styles.root, sceneStyle]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: statusBarHeight, paddingBottom: 34 + bottomPadding }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.back} activeOpacity={0.82} onPress={requestClose}>
            <MdiIcon name="chevron-left" rawSize={20} color={colors.ink.input} />
          </TouchableOpacity>
          <Text size={22} color={colors.ink.subpageTitle} style={styles.title} numberOfLines={1}>{title}</Text>
        </View>

        {listMode
          ? null
          : (
            <View style={styles.segment}>
              {RANGES.map(id => {
                const selected = id == range
                return (
                  <TouchableOpacity
                    key={id}
                    style={[styles.segmentItem, selected ? styles.segmentItemOn : null]}
                    activeOpacity={0.82}
                    onPress={() => { setRange(id) }}
                  >
                    <Text
                      size={13}
                      color={selected ? colors.ink.strong : colors.ink.chipIdle}
                      style={selected ? styles.segmentLabelOn : styles.segmentLabel}
                      numberOfLines={1}
                    >{t(rangeLabelKey[id])}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
            )}

        {listMode
          ? (
            <RankCard
              styles={styles}
              colors={colors}
              empty={t('stats_empty')}
              countUnit={t('stats_unit_count')}
              songs={listMode == 'songs' ? songs : []}
              artists={listMode == 'artists' ? artists : []}
              durationText={durationText}
              onPlay={playSong}
            />
            )
          : (
            <>
              <View style={[styles.card, styles.summary]}>
                <View style={styles.eyeRow}>
                  <Text size={11} color={colors.ink.eyebrow} style={styles.eyebrow}>{t(listenLabelKey[range])}</Text>
                  <Text size={12} color={colors.ink.secondary}>{rangeText}</Text>
                </View>
                <View style={styles.figures}>
                  <View style={styles.figure}>
                    <Text size={12} color={colors.ink.secondary} style={styles.figureLabel}>{t('stats_duration')}</Text>
                    <Text size={30} color={colors.ink.pageTitle} style={styles.figureValue}>
                      {hours > 0
                        ? <>{hours}<Text size={14} color={colors.ink.list} style={styles.figureUnit}>{t('stats_unit_hour')}</Text></>
                        : null}
                      {minutes}<Text size={14} color={colors.ink.list} style={styles.figureUnit}>{t('stats_unit_minute')}</Text>
                    </Text>
                  </View>
                  <View style={[styles.figure, styles.figureSplit]}>
                    <Text size={12} color={colors.ink.secondary} style={styles.figureLabel}>{t('stats_play_count')}</Text>
                    <Text size={30} color={colors.ink.pageTitle} style={styles.figureValue}>
                      {stats.playCount}<Text size={14} color={colors.ink.list} style={styles.figureUnit}>{t('stats_unit_count')}</Text>
                    </Text>
                  </View>
                </View>
                <View style={styles.compare}>
                  {compareText
                    ? (
                      <View style={styles.pill}>
                        <MdiIcon name={stats.listenedMs >= stats.previousListenedMs ? 'menu-up' : 'menu-down'} rawSize={18} color={colors.ink.pill} />
                        <Text size={12} color={colors.ink.pill} style={styles.pillText}>{compareText}</Text>
                      </View>
                      )
                    : null}
                  <Text size={12} color={colors.ink.secondary}>{t('stats_daily_avg', { duration: durationText(stats.dayCount ? stats.listenedMs / stats.dayCount : 0, true) })}</Text>
                </View>
                <View style={styles.chartBlock}>
                  <View style={styles.chartToolbar}>
                    <Text size={12} color={colors.ink.secondary} style={styles.chartUnit}>{t('stats_daily_unit')}</Text>
                    <SegmentedIconSwitch
                      value={chartMode}
                      items={chartSwitchItems}
                      onChange={onChartModeChange}
                      itemWidth={32}
                      itemHeight={26}
                      padding={2}
                    />
                  </View>
                  <ListeningChart
                    buckets={stats.chart}
                    range={range}
                    mode={chartMode}
                    styles={styles}
                    colors={colors}
                    t={t}
                  />
                </View>
              </View>

              <SectionHeader
                title={t('stats_top_songs')}
                link={t('stats_view_all')}
                colors={colors}
                styles={styles}
                onPress={() => { setListMode('songs') }}
              />
              <RankCard
                styles={styles}
                colors={colors}
                empty={t('stats_empty')}
                countUnit={t('stats_unit_count')}
                songs={songs}
                artists={[]}
                durationText={durationText}
                onPlay={playSong}
              />

              <SectionHeader
                title={t('stats_top_artists')}
                link={t('stats_view_all')}
                colors={colors}
                styles={styles}
                onPress={() => { setListMode('artists') }}
              />
              <RankCard
                styles={styles}
                colors={colors}
                empty={t('stats_empty')}
                countUnit={t('stats_unit_count')}
                songs={[]}
                artists={artists}
                durationText={durationText}
                onPlay={playSong}
              />

              <View style={styles.footnote}>
                <MdiIcon name="information-outline" rawSize={14} color={colors.ink.faint} />
                <Text size={12} color={colors.ink.faint} style={styles.footnoteText}>
                  {t('stats_footnote_rule')}{luxSync ? t('stats_footnote_lux') : t('stats_footnote_local')}
                </Text>
              </View>
            </>
            )}
      </ScrollView>
    </Animated.View>
  )
}

const SectionHeader = ({
  title,
  link,
  colors,
  styles,
  onPress,
}: {
  title: string
  link: string
  colors: LuxColors
  styles: ReturnType<typeof useLuxStyles>
  onPress: () => void
}) => (
  <View style={styles.sectionHeader}>
    <Text size={18} color={colors.ink.strong} style={styles.sectionTitle}>{title}</Text>
    <TouchableOpacity style={styles.sectionLink} activeOpacity={0.8} onPress={onPress}>
      <Text size={13} color={colors.ink.olive} style={styles.sectionLinkText}>{link}</Text>
      <MdiIcon name="chevron-right" rawSize={16} color={colors.ink.olive} />
    </TouchableOpacity>
  </View>
)

const RankCard = ({
  styles,
  colors,
  empty,
  countUnit,
  songs,
  artists,
  durationText,
  onPlay,
}: {
  styles: ReturnType<typeof useLuxStyles>
  colors: LuxColors
  empty: string
  countUnit: string
  songs: RankedSong[]
  artists: RankedArtist[]
  durationText: (ms: number, padMinutes: boolean) => string
  onPlay: (song: PlayHistorySong) => void
}) => {
  const rows = songs.length ? songs : artists
  if (!rows.length) {
    return (
      <View style={[styles.card, styles.list]}>
        <View style={styles.empty}>
          <Text size={13} color={colors.ink.meta}>{empty}</Text>
        </View>
      </View>
    )
  }
  return (
    <View style={[styles.card, styles.list]}>
      {songs.map((song, index) => (
        <View key={song.key}>
          <TouchableOpacity style={styles.row} activeOpacity={0.8} onPress={() => { onPlay(song.song) }}>
            <Text size={14} color={index < 3 ? colors.ink.strong : colors.ink.index} style={styles.rank}>{index + 1}</Text>
            <View style={[styles.cover, { backgroundColor: colors.playlistCovers[index % colors.playlistCovers.length].surface }]}>
              {song.song.img
                ? <Image style={styles.coverImage} url={song.song.img} />
                : <MdiIcon name="music-note" size={20} color={colors.playlistCovers[index % colors.playlistCovers.length].accent} />}
            </View>
            <View style={styles.rowText}>
              <Text size={14} color={colors.ink.strong} style={styles.songTitle} numberOfLines={1}>{song.song.name}</Text>
              <Text size={11} color={colors.ink.meta} style={styles.songSub} numberOfLines={1}>{song.song.singer}</Text>
            </View>
            <View style={styles.count}>
              <Text size={15} color={colors.ink.list} style={styles.countValue}>{song.playCount}</Text>
              <Text size={12} color={colors.ink.secondary}>{countUnit}</Text>
            </View>
          </TouchableOpacity>
          {index < songs.length - 1 ? <View style={styles.divider} /> : null}
        </View>
      ))}
      {artists.map((artist, index) => (
        <View key={artist.name}>
          <View style={styles.row}>
            <Text size={14} color={index < 3 ? colors.ink.strong : colors.ink.index} style={styles.rank}>{index + 1}</Text>
            <ArtistFace name={artist.name} fallback={artist.fallbackImg} />
            <View style={styles.rowText}>
              <Text size={15} color={colors.ink.list} style={styles.artistTitle} numberOfLines={1}>{artist.name}</Text>
              <Text size={12} color={colors.ink.secondary} style={styles.artistSub} numberOfLines={1}>{durationText(artist.listenedMs, true)}</Text>
            </View>
            <View style={styles.count}>
              <Text size={15} color={colors.ink.list} style={styles.countValue}>{artist.playCount}</Text>
              <Text size={12} color={colors.ink.secondary}>{countUnit}</Text>
            </View>
          </View>
          {index < artists.length - 1 ? <View style={styles.divider} /> : null}
        </View>
      ))}
    </View>
  )
}

export default ListeningStatsPage
