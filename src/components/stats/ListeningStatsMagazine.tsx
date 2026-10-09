/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { Fragment, useCallback, useMemo, useState } from 'react'
import { ScrollView, TouchableOpacity, View, useWindowDimensions } from 'react-native'
import Svg, { Circle, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg'

import { MdiIcon } from '@/components/common/MdiIcon'
import Text from '@/components/common/Text'
import {
  BackButton,
  DeltaPill,
  Hairline,
  RankNumber,
  RankedRow,
  SectionHeader,
  TextTabs,
} from '@/components/magazine'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import {
  DISPLAY_AFTER_TABS,
  EYEBROW_AFTER_H1,
  H1_AFTER_TOP,
  PAGE_GUTTER,
  SECTION_TO_LIST,
  TABS_AFTER_EYEBROW,
  TOP_BAR_MARGIN_TOP,
  magType,
} from '@/theme/magazineType'
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
  rangeLabelKey,
  sharePeriodKey,
  weekdayKey,
} from './statsShared'

const BAR_MAX = 118

const useStyles = sharedLuxStyles(() => (createStyle({
  root: { flex: 1 },
  content: { paddingHorizontal: PAGE_GUTTER, paddingBottom: 72 },
  topBar: { minHeight: 40, flexDirection: 'row', alignItems: 'center', marginTop: TOP_BAR_MARGIN_TOP },
  pageTitle: { fontWeight: '800', letterSpacing: -1, marginTop: H1_AFTER_TOP, lineHeight: 44 },
  kicker: { fontWeight: '700', letterSpacing: 2, marginTop: EYEBROW_AFTER_H1 },
  tabs: { marginTop: TABS_AFTER_EYEBROW },
  durationLabel: { fontWeight: '600', marginTop: DISPLAY_AFTER_TABS },
  bigRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 2 },
  bigNumber: { fontWeight: '800', letterSpacing: -6, lineHeight: 120, includeFontPadding: false },
  bigUnit: { fontWeight: '700', marginLeft: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginTop: 12 },
  metaText: { fontWeight: '600' },
  metaStrong: { fontWeight: '800' },
  metaSep: { width: 1, height: 14 },
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
  listBlock: { marginTop: SECTION_TO_LIST },
  artistRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  artistText: { flex: 1, minWidth: 0, marginLeft: 12 },
  songTitle: { fontWeight: '700' },
  songSub: { marginTop: 3 },
  durationValue: { fontWeight: '800', marginLeft: 10, fontVariant: ['tabular-nums'] },
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
  t,
}: {
  buckets: ChartBucket[]
  range: PlayRangeId
  mode: 'bar' | 'line'
  styles: ReturnType<typeof useStyles>
  t: (key: string, params?: Record<string, string | number>) => string
}) => {
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const [measuredWidth, setMeasuredWidth] = useState(0)
  const { width: windowWidth } = useWindowDimensions()
  const width = measuredWidth || Math.max(1, windowWidth - scaleSizeW(PAGE_GUTTER * 2))
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
                  color={r.eyebrow}
                  style={[styles.dayLabel, bucket.kind == 'hour2' ? styles.hourLabel : null]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >{label.text}</Text>
                )
              : <Text size={10} color={r.eyebrow} style={styles.dayLabel}> </Text>}
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
            <Line x1={0} y1={plotHeight - 1} x2={width} y2={plotHeight - 1} stroke={r.ink} strokeWidth={1} />
            {polyline
              ? <Polyline points={polyline} fill="none" stroke={r.ink} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
              : null}
            {points.map(point => (
              <Circle
                key={point.bucket.start}
                cx={point.x}
                cy={point.y + scaleSizeH(6)}
                r={point.bucket.isCurrent ? 4.5 : 3.2}
                fill={point.bucket.isCurrent ? r.accent : r.paper}
                stroke={point.bucket.isCurrent ? r.accent : r.ink}
                strokeWidth={point.bucket.isCurrent ? 0 : 2}
              />
            ))}
          </Svg>
          {axisLabels}
          {range == 'today' ? <View style={styles.axisEndRow}><Text size={10} color={r.eyebrow}>{t('stats_hour_end')}</Text></View> : null}
        </View>
      </View>
    )
  }

  return (
    <View style={styles.chartArea} onLayout={onLayout}>
      <Svg width={width} height={plotHeight} viewBox={`0 0 ${width} ${plotHeight}`}>
        <Line x1={0} y1={plotHeight - 1} x2={width} y2={plotHeight - 1} stroke={r.ink} strokeWidth={1} />
        {points.map(({ bucket, empty, height, x }) => {
          const barHeight = empty ? scaleSizeH(3) : height
          const y = plotHeight - barHeight
          const fill = empty ? r.hairline : bucket.isCurrent ? r.accent : r.ink
          const label = !empty && bucket.isCurrent
            ? (bucket.minutes > 0 ? `${bucket.minutes}${t('stats_unit_minute')}` : t('stats_minute_less_than_one'))
            : null
          return (
            <Fragment key={bucket.start}>
              {label
                ? <SvgText x={x} y={Math.max(12, y - 8)} fill={r.ink} fontSize={11} fontWeight="700" textAnchor="middle">{label}</SvgText>
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
      {range == 'today' ? <View style={styles.axisEndRow}><Text size={10} color={r.eyebrow}>{t('stats_hour_end')}</Text></View> : null}
    </View>
  )
}

const SongRankList = ({
  styles,
  empty,
  songs,
  durationParts,
  onPlay,
}: {
  styles: ReturnType<typeof useStyles>
  empty: string
  songs: RankedSong[]
  durationParts: (ms: number) => { value: string, unit: string }
  onPlay: (song: PlayHistorySong) => void
}) => {
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  if (!songs.length) {
    return (
      <View style={styles.empty}>
        <Text size={13} color={r.muted}>{empty}</Text>
      </View>
    )
  }
  return (
    <View style={styles.listBlock}>
      {songs.map((song, index) => {
        const parts = durationParts(song.listenedMs)
        return (
          <RankedRow
            key={song.key}
            rank={index + 1}
            title={song.song.name}
            subtitle={song.song.singer}
            coverUri={song.song.img}
            value={parts.value}
            unit={parts.unit}
            last={index == songs.length - 1}
            onPress={() => { onPlay(song.song) }}
          />
        )
      })}
    </View>
  )
}

const ArtistRankList = ({
  styles,
  empty,
  artists,
  totalListenedMs,
  range,
  durationParts,
  t,
}: {
  styles: ReturnType<typeof useStyles>
  empty: string
  artists: RankedArtist[]
  totalListenedMs: number
  range: PlayRangeId
  durationParts: (ms: number) => { value: string, unit: string }
  t: (key: string, params?: Record<string, string | number>) => string
}) => {
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  if (!artists.length) {
    return (
      <View style={styles.empty}>
        <Text size={13} color={r.muted}>{empty}</Text>
      </View>
    )
  }
  return (
    <View style={styles.listBlock}>
      {artists.map((artist, index) => {
        const parts = durationParts(artist.listenedMs)
        const percent = totalListenedMs > 0 ? Math.round(artist.listenedMs / totalListenedMs * 100) : 0
        const last = index == artists.length - 1
        return (
          <View key={artist.name}>
            <View style={styles.artistRow}>
              <RankNumber rank={index + 1} />
              <ArtistFace name={artist.name} fallback={artist.fallbackImg} size={46} toneIndex={index} />
              <View style={styles.artistText}>
                <Text size={magType.rowTitle.size} color={r.ink} style={styles.songTitle} numberOfLines={1}>{artist.name}</Text>
                <Text size={magType.meta.size} color={r.muted} style={styles.songSub} numberOfLines={1}>
                  {t('stats_artist_share', { period: t(sharePeriodKey[range]), percent })}
                </Text>
              </View>
              <Text size={magType.value.size} color={r.ink} style={styles.durationValue}>
                {parts.value}<Text size={magType.valueUnit.size} color={r.muted} style={styles.durationUnit}>{parts.unit}</Text>
              </Text>
            </View>
            {last ? null : <Hairline />}
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
  const r = magazineRoles(colors)
  const statusBarHeight = useStatusbarHeight()
  const {
    t, range, setRange, now, luxSync, chartMode, onChartModeChange, stats, songs, artists,
    hours, minutes, compareDiffMinutes, dailyAvgMs, durationText, durationParts, dateText, playSong,
  } = model

  const rangeTabs = useMemo(
    () => RANGES.map(id => ({ id, label: t(rangeLabelKey[id]) })),
    [t],
  )

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

  const chartToggle = (
    <View style={styles.chartToggle}>
      <TouchableOpacity style={styles.chartToggleItem} activeOpacity={0.8} onPress={() => { onChartModeChange('bar') }} accessibilityLabel={t('stats_chart_bar')}>
        <MdiIcon name="chart-bar" size={15} color={chartMode == 'bar' ? r.ink : r.quiet} />
        <Text size={12} color={chartMode == 'bar' ? r.ink : r.quiet} style={styles.chartToggleLabel}>{t('stats_chart_bar_short')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.chartToggleItem} activeOpacity={0.8} onPress={() => { onChartModeChange('line') }} accessibilityLabel={t('stats_chart_line')}>
        <MdiIcon name="chart-line" size={15} color={chartMode == 'line' ? r.ink : r.quiet} />
        <Text size={12} color={chartMode == 'line' ? r.ink : r.quiet} style={styles.chartToggleLabel}>{t('stats_chart_line_short')}</Text>
      </TouchableOpacity>
    </View>
  )

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: r.paper }]}
      contentContainerStyle={[styles.content, { paddingTop: statusBarHeight, paddingBottom: 72 + bottomPadding }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topBar}>
        <BackButton onPress={onClose} />
      </View>

      <Text size={magType.h1.size} color={r.display} style={styles.pageTitle}>{t('stats_title')}</Text>
      <Text size={magType.eyebrow.size} color={r.eyebrow} style={styles.kicker}>{kickerText}</Text>

      <TextTabs
        items={rangeTabs}
        value={range}
        onChange={(id) => { setRange(id as PlayRangeId) }}
        style={styles.tabs}
      />

      <Text size={13} color={r.muted} style={styles.durationLabel}>
        {t('stats_duration_heading', { range: t(rangeLabelKey[range]) })}
      </Text>
      <View style={styles.bigRow}>
        {hours > 0
          ? (
            <>
              <Text size={magType.displayXL.size} color={r.display} style={styles.bigNumber}>{hours}</Text>
              <Text size={30} color={r.display} style={styles.bigUnit}>{t('stats_unit_hour')}</Text>
              <Text size={magType.displayXL.size} color={r.display} style={styles.bigNumber}>{minutes}</Text>
              <Text size={30} color={r.display} style={styles.bigUnit}>{t('stats_unit_minute')}</Text>
            </>
            )
          : (
            <>
              <Text size={magType.displayXL.size} color={r.display} style={styles.bigNumber}>{minutes}</Text>
              <Text size={30} color={r.display} style={styles.bigUnit}>{t('stats_unit_minute')}</Text>
            </>
            )}
      </View>

      <View style={styles.metaRow}>
        {compare
          ? (
            <>
              <DeltaPill
                label={compare.delta}
                direction={compare.flat ? 'none' : compare.up ? 'up' : 'down'}
              />
              <Text size={14} color={r.muted} style={styles.metaText}>{compare.label}</Text>
              <View style={[styles.metaSep, { backgroundColor: r.hairline }]} />
            </>
            )
          : null}
        <Text size={14} color={r.muted} style={styles.metaText}>
          {t('stats_daily_avg_prefix')}<Text size={14} color={r.ink} style={styles.metaStrong}>{dailyAvg}</Text>
        </Text>
      </View>

      <SectionHeader title={chartTitle} trailing={chartToggle} />
      <MagazineChart buckets={stats.chart} range={range} mode={chartMode} styles={styles} t={t} />

      <SectionHeader title={t('stats_top_songs')} meta={t('stats_sort_by_duration')} />
      <SongRankList styles={styles} empty={t('stats_empty')} songs={songs} durationParts={durationParts} onPlay={playSong} />

      <SectionHeader title={t('stats_top_artists')} meta={t('stats_sort_by_duration')} />
      <ArtistRankList
        styles={styles}
        empty={t('stats_empty')}
        artists={artists}
        totalListenedMs={stats.listenedMs}
        range={range}
        durationParts={durationParts}
        t={t}
      />

      <View style={styles.footnote}>
        <MdiIcon name="information-outline" size={14} color={r.faint} />
        <Text size={12} color={r.faint} style={styles.footnoteText}>
          {t('stats_footnote_rule')}{luxSync ? t('stats_footnote_lux') : t('stats_footnote_local')}
        </Text>
      </View>
    </ScrollView>
  )
}
