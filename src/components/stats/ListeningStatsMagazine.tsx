/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { Fragment, useCallback, useState } from 'react'
import { ScrollView, TouchableOpacity, View, useWindowDimensions } from 'react-native'
import Svg, { Circle, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg'

import Image from '@/components/common/Image'
import { MdiIcon } from '@/components/common/MdiIcon'
import Text from '@/components/common/Text'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { type LuxColors } from '@/theme/luxTokens'
import { useStatusbarHeight } from '@/store/common/hook'
import { buildStatsChartLayout, statsBucketLabel } from '@/utils/playHistory/chartLayout'
import { type ChartBucket, type PlayRangeId, type RankedArtist, type RankedSong } from '@/utils/playHistory/range'
import { type PlayHistorySong } from '@/utils/playHistory/types'
import { scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'
import { createStyle } from '@/utils/tools'

import { ArtistFace } from './ArtistFace'
import { type ListeningStatsModel } from './useListeningStatsModel'
import {
  RANGES,
  compareLabelKey,
  pad2,
  rangeLabelKey,
  sharePeriodKey,
  weekdayKey,
} from './statsShared'

const BAR_MAX = 118

const useStyles = sharedLuxStyles((colors: LuxColors) => (createStyle({
  root: { flex: 1 },
  content: { paddingHorizontal: 22, paddingBottom: 72 },
  topBar: { minHeight: 40, flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.ink.strong,
    backgroundColor: 'transparent',
  },
  pageTitle: { fontWeight: '800', letterSpacing: -1, marginTop: 18, lineHeight: 44 },
  kicker: { fontWeight: '700', letterSpacing: 2, marginTop: 8 },
  tabs: {
    flexDirection: 'row',
    marginTop: 22,
    borderBottomWidth: 1,
    borderBottomColor: colors.line.divider,
    gap: 22,
  },
  tab: { paddingBottom: 10 },
  tabOn: { borderBottomWidth: 3, borderBottomColor: colors.ink.strong, marginBottom: -1 },
  tabLabel: { fontWeight: '600' },
  tabLabelOn: { fontWeight: '800' },
  durationLabel: { fontWeight: '600', marginTop: 28 },
  bigRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 2 },
  bigNumber: { fontWeight: '800', letterSpacing: -6, lineHeight: 120 },
  bigUnit: { fontWeight: '700', marginLeft: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginTop: 12 },
  pill: {
    height: 26,
    paddingLeft: 7,
    paddingRight: 10,
    borderRadius: 999,
    backgroundColor: colors.accent.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  pillText: { fontWeight: '800' },
  metaText: { fontWeight: '600' },
  metaStrong: { fontWeight: '800' },
  metaSep: { width: 1, height: 14, backgroundColor: colors.line.divider },
  rule: { height: 1, backgroundColor: colors.ink.strong, marginTop: 34, opacity: 0.9 },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 12 },
  sectionTitle: { fontWeight: '800', letterSpacing: -0.3 },
  sectionMeta: { fontWeight: '600', letterSpacing: 1 },
  chartToggle: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  chartToggleItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  chartToggleLabel: { fontWeight: '700' },
  chartArea: { width: '100%', height: 176, marginTop: 14 },
  bars: { flex: 1, flexDirection: 'row', alignItems: 'flex-end' },
  barColumn: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  dayLabel: { marginTop: 8, height: 18, textAlign: 'center' },
  hourLabel: { maxWidth: '100%', paddingHorizontal: 0 },
  lineWrap: { flex: 1 },
  axisEndRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: -2 },
  listBlock: { marginTop: 6 },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line.divider,
  },
  rowLast: { borderBottomWidth: 0 },
  rank: { width: 38, fontWeight: '800', letterSpacing: -1 },
  rankDim: { fontWeight: '300' },
  cover: {
    width: 46,
    height: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  coverImage: { width: 46, height: 46, borderRadius: 10 },
  rowText: { flex: 1, minWidth: 0, marginLeft: 12 },
  songTitle: { fontWeight: '700' },
  songSub: { marginTop: 3 },
  durationValue: { fontWeight: '800', marginLeft: 10 },
  durationUnit: { fontWeight: '600', marginLeft: 1 },
  empty: { paddingVertical: 22, alignItems: 'center' },
  footnote: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 22, paddingHorizontal: 2 },
  footnoteText: { flex: 1, lineHeight: 18 },
})))

const MagazineChart = ({
  buckets,
  range,
  mode,
  styles,
  colors,
  t,
}: {
  buckets: ChartBucket[]
  range: PlayRangeId
  mode: 'bar' | 'line'
  styles: ReturnType<typeof useStyles>
  colors: LuxColors
  t: (key: string, params?: Record<string, string | number>) => string
}) => {
  const [measuredWidth, setMeasuredWidth] = useState(0)
  const { width: windowWidth } = useWindowDimensions()
  const width = measuredWidth || Math.max(1, windowWidth - scaleSizeW(44))
  const maxHeight = scaleSizeH(BAR_MAX)
  const plotHeight = maxHeight + scaleSizeH(12)
  const labelReserve = scaleSizeH(28)
  const { points, slotWidth } = buildStatsChartLayout(buckets, width, maxHeight, scaleSizeH(3))
  const barWidth = Math.min(scaleSizeW(14), Math.max(scaleSizeW(8), slotWidth * 0.48))
  const onLayout = useCallback((event: { nativeEvent: { layout: { width: number } } }) => {
    const nextWidth = event.nativeEvent.layout.width
    if (Number.isFinite(nextWidth) && nextWidth > 0) setMeasuredWidth(nextWidth)
  }, [])

  const axisLabels = (
    <View style={[styles.bars, { height: labelReserve, alignItems: 'flex-start' }]}>
      {buckets.map(bucket => {
        const label = statsBucketLabel(bucket, range, t)
        return (
          <View key={bucket.start} style={styles.barColumn}>
            {label.show
              ? (
                <Text
                  size={10}
                  color={colors.ink.eyebrow}
                  style={[styles.dayLabel, bucket.kind == 'hour2' ? styles.hourLabel : null]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >{label.text}</Text>
                )
              : <Text size={10} color={colors.ink.eyebrow} style={styles.dayLabel}> </Text>}
          </View>
        )
      })}
    </View>
  )

  if (mode == 'line') {
    const polyline = points.map(point => `${point.x},${point.y + scaleSizeH(6)}`).join(' ')
    return (
      <View style={styles.chartArea} onLayout={onLayout}>
        <View style={styles.lineWrap}>
          <Svg width={width} height={plotHeight} viewBox={`0 0 ${width} ${plotHeight}`}>
            <Line x1={0} y1={plotHeight - 1} x2={width} y2={plotHeight - 1} stroke={colors.ink.strong} strokeWidth={1} />
            {polyline
              ? <Polyline points={polyline} fill="none" stroke={colors.ink.strong} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
              : null}
            {points.map(point => (
              <Circle
                key={point.bucket.start}
                cx={point.x}
                cy={point.y + scaleSizeH(6)}
                r={point.bucket.isCurrent ? 4.5 : 3.2}
                fill={point.bucket.isCurrent ? colors.accent.primary : colors.bg.app}
                stroke={point.bucket.isCurrent ? colors.accent.primary : colors.ink.strong}
                strokeWidth={point.bucket.isCurrent ? 0 : 2}
              />
            ))}
          </Svg>
          {axisLabels}
          {range == 'today' ? <View style={styles.axisEndRow}><Text size={10} color={colors.ink.eyebrow}>{t('stats_hour_end')}</Text></View> : null}
        </View>
      </View>
    )
  }

  return (
    <View style={styles.chartArea} onLayout={onLayout}>
      <Svg width={width} height={plotHeight} viewBox={`0 0 ${width} ${plotHeight}`}>
        <Line x1={0} y1={plotHeight - 1} x2={width} y2={plotHeight - 1} stroke={colors.ink.strong} strokeWidth={1} />
        {points.map(({ bucket, empty, height, x }) => {
          const barHeight = empty ? scaleSizeH(3) : height
          const y = plotHeight - barHeight
          const fill = empty ? colors.line.divider : bucket.isCurrent ? colors.accent.primary : colors.ink.strong
          const label = !empty && bucket.isCurrent
            ? (bucket.minutes > 0 ? `${bucket.minutes}${t('stats_unit_minute')}` : t('stats_minute_less_than_one'))
            : null
          return (
            <Fragment key={bucket.start}>
              {label
                ? <SvgText x={x} y={Math.max(12, y - 8)} fill={colors.ink.strong} fontSize={11} fontWeight="700" textAnchor="middle">{label}</SvgText>
                : null}
              <Rect
                x={x - barWidth / 2}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={empty ? scaleSizeW(1.5) : scaleSizeW(3)}
                fill={fill}
                opacity={empty ? 0.55 : 1}
              />
            </Fragment>
          )
        })}
      </Svg>
      {axisLabels}
      {range == 'today' ? <View style={styles.axisEndRow}><Text size={10} color={colors.ink.eyebrow}>{t('stats_hour_end')}</Text></View> : null}
    </View>
  )
}

const RankList = ({
  styles,
  colors,
  empty,
  songs,
  artists,
  totalListenedMs,
  range,
  durationParts,
  t,
  onPlay,
}: {
  styles: ReturnType<typeof useStyles>
  colors: LuxColors
  empty: string
  songs: RankedSong[]
  artists: RankedArtist[]
  totalListenedMs: number
  range: PlayRangeId
  durationParts: (ms: number) => { value: string, unit: string }
  t: (key: string, params?: Record<string, string | number>) => string
  onPlay: (song: PlayHistorySong) => void
}) => {
  const rows = songs.length ? songs : artists
  if (!rows.length) {
    return (
      <View style={styles.empty}>
        <Text size={13} color={colors.ink.meta}>{empty}</Text>
      </View>
    )
  }
  return (
    <View style={styles.listBlock}>
      {songs.map((song, index) => {
        const parts = durationParts(song.listenedMs)
        return (
          <TouchableOpacity
            key={song.key}
            style={[styles.row, index == songs.length - 1 ? styles.rowLast : null]}
            activeOpacity={0.8}
            onPress={() => { onPlay(song.song) }}
          >
            <Text size={30} color={index == 0 ? colors.ink.pageTitle : colors.ink.faint} style={[styles.rank, index == 0 ? null : styles.rankDim]}>{pad2(index + 1)}</Text>
            <View style={[styles.cover, { backgroundColor: colors.playlistCovers[index % colors.playlistCovers.length].surface }]}>
              {song.song.img
                ? <Image style={styles.coverImage} url={song.song.img} />
                : <MdiIcon name="music-note" size={20} color={colors.playlistCovers[index % colors.playlistCovers.length].accent} />}
            </View>
            <View style={styles.rowText}>
              <Text size={16} color={colors.ink.strong} style={styles.songTitle} numberOfLines={1}>{song.song.name}</Text>
              <Text size={12} color={colors.ink.secondary} style={styles.songSub} numberOfLines={1}>{song.song.singer}</Text>
            </View>
            <Text size={15} color={colors.ink.strong} style={styles.durationValue}>
              {parts.value}<Text size={11} color={colors.ink.secondary} style={styles.durationUnit}>{parts.unit}</Text>
            </Text>
          </TouchableOpacity>
        )
      })}
      {artists.map((artist, index) => {
        const parts = durationParts(artist.listenedMs)
        const percent = totalListenedMs > 0 ? Math.round(artist.listenedMs / totalListenedMs * 100) : 0
        return (
          <View key={artist.name} style={[styles.row, index == artists.length - 1 ? styles.rowLast : null]}>
            <Text size={30} color={index == 0 ? colors.ink.pageTitle : colors.ink.faint} style={[styles.rank, index == 0 ? null : styles.rankDim]}>{pad2(index + 1)}</Text>
            <ArtistFace name={artist.name} fallback={artist.fallbackImg} size={46} />
            <View style={styles.rowText}>
              <Text size={16} color={colors.ink.strong} style={styles.songTitle} numberOfLines={1}>{artist.name}</Text>
              <Text size={12} color={colors.ink.secondary} style={styles.songSub} numberOfLines={1}>
                {t('stats_artist_share', { period: t(sharePeriodKey[range]), percent })}
              </Text>
            </View>
            <Text size={15} color={colors.ink.strong} style={styles.durationValue}>
              {parts.value}<Text size={11} color={colors.ink.secondary} style={styles.durationUnit}>{parts.unit}</Text>
            </Text>
          </View>
        )
      })}
    </View>
  )
}

export const ListeningStatsMagazine = ({
  model,
  onClose,
  bottomPadding,
}: {
  model: ListeningStatsModel
  onClose: () => void
  bottomPadding: number
}) => {
  const styles = useStyles()
  const { colors } = useLuxTheme()
  const statusBarHeight = useStatusbarHeight()
  const {
    t, range, setRange, now, luxSync, chartMode, onChartModeChange, stats, songs, artists,
    hours, minutes, compareDiffMinutes, dailyAvgMs, durationText, durationParts, dateText, playSong,
  } = model

  const kickerText = t('stats_kicker', {
    date: `${dateText(now)} ${t(weekdayKey[new Date(now).getDay()])}`,
  })
  const dailyAvg = durationText(dailyAvgMs, false)
  const chartTitle = range == 'today' ? t('stats_chart_slots') : t('stats_daily_title')
  const compare = compareDiffMinutes == null
    ? null
    : {
        up: compareDiffMinutes >= 0,
        flat: compareDiffMinutes == 0,
        delta: compareDiffMinutes == 0
          ? t('stats_compare_flat')
          : durationText(Math.abs(compareDiffMinutes) * 60_000, false),
        label: t(compareLabelKey[range as Exclude<PlayRangeId, 'all'>]),
      }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: statusBarHeight, paddingBottom: 72 + bottomPadding }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.back} activeOpacity={0.82} onPress={onClose}>
          <MdiIcon name="chevron-left" rawSize={22} color={colors.ink.strong} />
        </TouchableOpacity>
      </View>

      <Text size={40} color={colors.ink.pageTitle} style={styles.pageTitle}>{t('stats_title')}</Text>
      <Text size={11} color={colors.ink.eyebrow} style={styles.kicker}>{kickerText}</Text>

      <View style={styles.tabs}>
        {RANGES.map(id => {
          const selected = id == range
          return (
            <TouchableOpacity key={id} style={[styles.tab, selected ? styles.tabOn : null]} activeOpacity={0.82} onPress={() => { setRange(id) }}>
              <Text size={15} color={selected ? colors.ink.strong : colors.ink.quiet} style={selected ? styles.tabLabelOn : styles.tabLabel} numberOfLines={1}>
                {t(rangeLabelKey[id])}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      <Text size={13} color={colors.ink.secondary} style={styles.durationLabel}>
        {t('stats_duration_heading', { range: t(rangeLabelKey[range]) })}
      </Text>
      <View style={styles.bigRow}>
        {hours > 0
          ? (
            <>
              <Text size={120} color={colors.ink.pageTitle} style={styles.bigNumber}>{hours}</Text>
              <Text size={30} color={colors.ink.pageTitle} style={styles.bigUnit}>{t('stats_unit_hour')}</Text>
              <Text size={120} color={colors.ink.pageTitle} style={styles.bigNumber}>{minutes}</Text>
              <Text size={30} color={colors.ink.pageTitle} style={styles.bigUnit}>{t('stats_unit_minute')}</Text>
            </>
            )
          : (
            <>
              <Text size={120} color={colors.ink.pageTitle} style={styles.bigNumber}>{minutes}</Text>
              <Text size={30} color={colors.ink.pageTitle} style={styles.bigUnit}>{t('stats_unit_minute')}</Text>
            </>
            )}
      </View>

      <View style={styles.metaRow}>
        {compare
          ? (
            <>
              <View style={styles.pill}>
                {compare.flat ? null : <MdiIcon name={compare.up ? 'arrow-up' : 'arrow-down'} rawSize={14} color={colors.ink.onAccent} />}
                <Text size={13} color={colors.ink.onAccent} style={styles.pillText}>{compare.delta}</Text>
              </View>
              <Text size={14} color={colors.ink.secondary} style={styles.metaText}>{compare.label}</Text>
              <View style={styles.metaSep} />
            </>
            )
          : null}
        <Text size={14} color={colors.ink.secondary} style={styles.metaText}>
          {t('stats_daily_avg_prefix')}<Text size={14} color={colors.ink.strong} style={styles.metaStrong}>{dailyAvg}</Text>
        </Text>
      </View>

      <View style={styles.rule} />
      <View style={styles.sectionHead}>
        <Text size={22} color={colors.ink.pageTitle} style={styles.sectionTitle}>{chartTitle}</Text>
        <View style={styles.chartToggle}>
          <TouchableOpacity style={styles.chartToggleItem} activeOpacity={0.8} onPress={() => { onChartModeChange('bar') }} accessibilityLabel={t('stats_chart_bar')}>
            <MdiIcon name="chart-bar" rawSize={15} color={chartMode == 'bar' ? colors.ink.strong : colors.ink.quiet} />
            <Text size={12} color={chartMode == 'bar' ? colors.ink.strong : colors.ink.quiet} style={styles.chartToggleLabel}>{t('stats_chart_bar_short')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.chartToggleItem} activeOpacity={0.8} onPress={() => { onChartModeChange('line') }} accessibilityLabel={t('stats_chart_line')}>
            <MdiIcon name="chart-line" rawSize={15} color={chartMode == 'line' ? colors.ink.strong : colors.ink.quiet} />
            <Text size={12} color={chartMode == 'line' ? colors.ink.strong : colors.ink.quiet} style={styles.chartToggleLabel}>{t('stats_chart_line_short')}</Text>
          </TouchableOpacity>
        </View>
      </View>
      <MagazineChart buckets={stats.chart} range={range} mode={chartMode} styles={styles} colors={colors} t={t} />

      <View style={styles.rule} />
      <View style={styles.sectionHead}>
        <Text size={22} color={colors.ink.pageTitle} style={styles.sectionTitle}>{t('stats_top_songs')}</Text>
        <Text size={12} color={colors.ink.eyebrow} style={styles.sectionMeta}>{t('stats_sort_by_duration')}</Text>
      </View>
      <RankList styles={styles} colors={colors} empty={t('stats_empty')} songs={songs} artists={[]} totalListenedMs={stats.listenedMs} range={range} durationParts={durationParts} t={t} onPlay={playSong} />

      <View style={styles.rule} />
      <View style={styles.sectionHead}>
        <Text size={22} color={colors.ink.pageTitle} style={styles.sectionTitle}>{t('stats_top_artists')}</Text>
        <Text size={12} color={colors.ink.eyebrow} style={styles.sectionMeta}>{t('stats_sort_by_duration')}</Text>
      </View>
      <RankList styles={styles} colors={colors} empty={t('stats_empty')} songs={[]} artists={artists} totalListenedMs={stats.listenedMs} range={range} durationParts={durationParts} t={t} onPlay={playSong} />

      <View style={styles.footnote}>
        <MdiIcon name="information-outline" rawSize={14} color={colors.ink.faint} />
        <Text size={12} color={colors.ink.faint} style={styles.footnoteText}>
          {t('stats_footnote_rule')}{luxSync ? t('stats_footnote_lux') : t('stats_footnote_local')}
        </Text>
      </View>
    </ScrollView>
  )
}
