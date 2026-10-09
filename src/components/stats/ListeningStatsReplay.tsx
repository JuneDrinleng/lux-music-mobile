/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { Fragment, useCallback, useMemo, useState } from 'react'
import { ScrollView, TouchableOpacity, View, useWindowDimensions } from 'react-native'
import Svg, { Circle, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg'

import Image from '@/components/common/Image'
import { MdiIcon } from '@/components/common/MdiIcon'
import Text from '@/components/common/Text'
import {
  BackButton,
  DeltaPill,
  Hairline,
  RankNumber,
  SectionHeader,
  TextTabs,
} from '@/components/magazine'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import {
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
  replayLeadKey,
  replaySongsTitleKey,
  sharePeriodKey,
} from './statsShared'

const BAR_MAX = 100
const ARTIST_GRID_N = 4

const useStyles = sharedLuxStyles(() => (createStyle({
  root: { flex: 1 },
  content: { paddingHorizontal: PAGE_GUTTER, paddingBottom: 72 },
  topBar: { minHeight: 40, flexDirection: 'row', alignItems: 'center', marginTop: TOP_BAR_MARGIN_TOP },
  tabs: { marginTop: TABS_AFTER_EYEBROW },
  lead: { fontWeight: '600', marginTop: 28 },
  heroNumber: { fontWeight: '800', letterSpacing: -4, lineHeight: 96, includeFontPadding: false, marginTop: 4 },
  heroUnit: { fontWeight: '800', marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 14 },
  metaText: { fontWeight: '600' },
  chartArea: { width: '100%', height: 148, marginTop: 14 },
  bars: { flex: 1, flexDirection: 'row', alignItems: 'flex-end' },
  barColumn: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  dayLabel: { marginTop: 6, height: 16, textAlign: 'center' },
  hourLabel: { maxWidth: '100%' },
  lineWrap: { flex: 1 },
  axisEndRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  listBlock: { marginTop: SECTION_TO_LIST },
  no1: { marginTop: 14 },
  no1Cover: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 6,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  no1CoverImage: { width: '100%', height: '100%', borderRadius: 6 },
  no1Meta: { fontWeight: '600', letterSpacing: 1, marginTop: 14 },
  no1Name: { fontWeight: '800', marginTop: 6, letterSpacing: -0.3 },
  no1Sub: { marginTop: 6 },
  songRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  songName: { flex: 1, minWidth: 0, fontWeight: '700', marginLeft: 8 },
  songDur: { fontWeight: '800', marginLeft: 10, fontVariant: ['tabular-nums'] },
  artistGrid: {
    marginTop: SECTION_TO_LIST + 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 14,
    rowGap: 18,
  },
  artistCell: { width: '47%', alignItems: 'flex-start' },
  artistRank: { fontWeight: '700', marginTop: 10 },
  artistName: { fontWeight: '800', marginTop: 2 },
  artistMeta: { marginTop: 2 },
  empty: { paddingVertical: 22, alignItems: 'center' },
  footnote: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 28 },
  footnoteText: { flex: 1, lineHeight: 18 },
})))

const ReplayChart = ({
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
  const plotHeight = maxHeight + scaleSizeH(10)
  const labelReserve = scaleSizeH(24)
  const { points, slotWidth } = buildStatsChartLayout(buckets, width, maxHeight, scaleSizeH(3))
  const barWidth = Math.min(scaleSizeW(16), Math.max(scaleSizeW(8), slotWidth * 0.55))
  const peakStart = useMemo(() => {
    let best = buckets[0]
    for (const bucket of buckets) {
      if (!best || bucket.listenedMs > best.listenedMs) best = bucket
    }
    return best && best.listenedMs > 0 ? best.start : null
  }, [buckets])
  const onLayout = useCallback((event: { nativeEvent: { layout: { width: number } } }) => {
    const nextWidth = event.nativeEvent.layout.width
    if (Number.isFinite(nextWidth) && nextWidth > 0) setMeasuredWidth(nextWidth)
  }, [])

  const isPeak = (bucket: ChartBucket) => peakStart != null && bucket.start == peakStart

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
    const polyline = points.map(point => `${point.x},${point.y + scaleSizeH(4)}`).join(' ')
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
                cy={point.y + scaleSizeH(4)}
                r={isPeak(point.bucket) ? 4.5 : 3}
                fill={isPeak(point.bucket) ? r.accent : r.paper}
                stroke={isPeak(point.bucket) ? r.accent : r.ink}
                strokeWidth={isPeak(point.bucket) ? 0 : 2}
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
          const peak = isPeak(bucket)
          const fill = empty ? r.hairline : peak ? r.accent : r.ink
          const label = !empty && peak
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

const SongBlock = ({
  styles,
  songs,
  totalListenedMs,
  range,
  durationParts,
  t,
  onPlay,
}: {
  styles: ReturnType<typeof useStyles>
  songs: RankedSong[]
  totalListenedMs: number
  range: PlayRangeId
  durationParts: (ms: number) => { value: string, unit: string }
  t: (key: string, params?: Record<string, string | number>) => string
  onPlay: (song: PlayHistorySong) => void
}) => {
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  if (!songs.length) {
    return <View style={styles.empty}><Text size={13} color={r.muted}>{t('stats_empty')}</Text></View>
  }
  const top = songs[0]
  const topParts = durationParts(top.listenedMs)
  const topPercent = totalListenedMs > 0 ? Math.round(top.listenedMs / totalListenedMs * 100) : 0
  const rest = songs.slice(1)
  const coverTone = colors.playlistCovers[0]

  return (
    <View style={styles.listBlock}>
      <TouchableOpacity style={styles.no1} activeOpacity={0.85} onPress={() => { onPlay(top.song) }}>
        <View style={[styles.no1Cover, { backgroundColor: coverTone.surface }]}>
          {top.song.img
            ? <Image style={styles.no1CoverImage} url={top.song.img} />
            : <MdiIcon name="music-note" size={48} color={coverTone.accent} />}
        </View>
        <Text size={magType.sectionMeta.size} color={r.eyebrow} style={styles.no1Meta}>
          {t('stats_replay_no1_plays', { count: top.playCount })}
        </Text>
        <Text size={magType.section.size} color={r.display} style={styles.no1Name} numberOfLines={2}>{top.song.name}</Text>
        <Text size={magType.meta.size} color={r.muted} style={styles.no1Sub} numberOfLines={2}>
          {top.song.singer} · {t('stats_share_inline', {
            duration: `${topParts.value}${topParts.unit}`,
            period: t(sharePeriodKey[range]),
            percent: topPercent,
          })}
        </Text>
      </TouchableOpacity>

      {rest.map((song, index) => {
        const parts = durationParts(song.listenedMs)
        return (
          <View key={song.key}>
            <Hairline />
            <TouchableOpacity style={styles.songRow} activeOpacity={0.85} onPress={() => { onPlay(song.song) }}>
              <RankNumber rank={index + 2} />
              <Text size={magType.rowTitle.size} color={r.ink} style={styles.songName} numberOfLines={1}>{song.song.name}</Text>
              <Text size={magType.value.size} color={r.ink} style={styles.songDur}>{parts.value}{parts.unit}</Text>
            </TouchableOpacity>
          </View>
        )
      })}
    </View>
  )
}

const ArtistBlock = ({
  styles,
  artists,
  durationParts,
  t,
}: {
  styles: ReturnType<typeof useStyles>
  artists: RankedArtist[]
  durationParts: (ms: number) => { value: string, unit: string }
  t: (key: string, params?: Record<string, string | number>) => string
}) => {
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  if (!artists.length) {
    return <View style={styles.empty}><Text size={13} color={r.muted}>{t('stats_empty')}</Text></View>
  }
  const grid = artists.slice(0, ARTIST_GRID_N)
  return (
    <View style={styles.artistGrid}>
      {grid.map((artist, index) => {
        const parts = durationParts(artist.listenedMs)
        return (
          <View key={artist.name} style={styles.artistCell}>
            <ArtistFace name={artist.name} fallback={artist.fallbackImg} size={88} toneIndex={index} />
            <Text size={magType.meta.size} color={r.eyebrow} style={styles.artistRank}>
              {t('stats_replay_artist_rank_label', { rank: index + 1 })}
            </Text>
            <Text size={magType.rowTitle.size} color={r.display} style={styles.artistName} numberOfLines={1}>{artist.name}</Text>
            <Text size={magType.meta.size} color={r.muted} style={styles.artistMeta}>{parts.value}{parts.unit}</Text>
          </View>
        )
      })}
    </View>
  )
}

export const ListeningStatsReplay = ({
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
    t, range, setRange, luxSync, chartMode, stats, songs, artists,
    hours, minutes, totalMinutes, compareDiffMinutes, peakBucket, durationText, durationParts, playSong,
  } = model

  const rangeTabs = useMemo(
    () => RANGES.map(id => ({ id, label: t(rangeLabelKey[id]) })),
    [t],
  )

  const displayValue = hours > 0 ? hours : totalMinutes
  const displayUnit = hours > 0
    ? (minutes > 0
        ? t('stats_replay_unit_hm', { minutes })
        : t('stats_replay_unit_h'))
    : t('stats_replay_unit_m')

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

  const chartHead = (() => {
    if (!peakBucket || peakBucket.listenedMs <= 0) {
      if (range == 'today') return { title: t('stats_chart_title_slots'), meta: undefined as string | undefined }
      if (range == 'year') return { title: t('stats_chart_title_month'), meta: undefined }
      if (range == 'all') return { title: t('stats_chart_title_year'), meta: undefined }
      return { title: t('stats_chart_title_day'), meta: undefined }
    }
    if (peakBucket.kind == 'hour2') {
      return {
        title: t('stats_chart_title_slots'),
        meta: t('stats_chart_meta_peak_today', { start: peakBucket.hour, end: peakBucket.hour + 2 }),
      }
    }
    if (peakBucket.kind == 'day') {
      return {
        title: t('stats_chart_title_day'),
        meta: t('stats_chart_meta_peak_day', { label: statsBucketLabel(peakBucket, range, t).text }),
      }
    }
    if (peakBucket.kind == 'month') {
      return {
        title: t('stats_chart_title_month'),
        meta: t('stats_chart_meta_peak_month', { month: peakBucket.month + 1 }),
      }
    }
    return {
      title: t('stats_chart_title_year'),
      meta: t('stats_chart_meta_peak_year', { year: peakBucket.year }),
    }
  })()

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: r.paper }]}
      contentContainerStyle={[styles.content, { paddingTop: statusBarHeight, paddingBottom: 72 + bottomPadding }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topBar}>
        <BackButton onPress={onClose} />
      </View>

      <TextTabs
        items={rangeTabs}
        value={range}
        onChange={(id) => { setRange(id as PlayRangeId) }}
        style={styles.tabs}
      />

      <Text size={magType.lead.size} color={r.ink} style={styles.lead}>{t(replayLeadKey[range])}</Text>
      <Text size={96} color={r.display} style={styles.heroNumber}>{displayValue}</Text>
      <Text size={26} color={r.display} style={styles.heroUnit}>{displayUnit}</Text>

      {compare
        ? (
          <View style={styles.metaRow}>
            <DeltaPill
              label={compare.delta}
              direction={compare.flat ? 'none' : compare.up ? 'up' : 'down'}
            />
            <Text size={14} color={r.muted} style={styles.metaText}>{compare.label}</Text>
          </View>
          )
        : null}

      <SectionHeader title={chartHead.title} meta={chartHead.meta} />
      <ReplayChart buckets={stats.chart} range={range} mode={chartMode} styles={styles} t={t} />

      <SectionHeader title={t(replaySongsTitleKey[range])} meta={t('stats_replay_rank1')} />
      <SongBlock
        styles={styles}
        songs={songs}
        totalListenedMs={stats.listenedMs}
        range={range}
        durationParts={durationParts}
        t={t}
        onPlay={playSong}
      />

      <SectionHeader title={t('stats_replay_artists_title')} meta={t('stats_top_artists')} />
      <ArtistBlock
        styles={styles}
        artists={artists}
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
