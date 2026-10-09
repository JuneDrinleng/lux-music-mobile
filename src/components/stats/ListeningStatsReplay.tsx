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
  rangeLabelKey,
  replayLeadKey,
  replaySongsTitleKey,
  sharePeriodKey,
} from './statsShared'

const BAR_MAX = 100

const useStyles = sharedLuxStyles((colors: LuxColors) => (createStyle({
  root: { flex: 1, backgroundColor: colors.bg.app },
  hero: {
    backgroundColor: colors.accent.primary,
    paddingBottom: 20,
    overflow: 'hidden',
  },
  heroBlob: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    right: -140,
    top: -120,
    backgroundColor: colors.glass.fill08,
  },
  heroInner: { paddingHorizontal: 20, position: 'relative' },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.glass.fill14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontWeight: '700' },
  navSpacer: { width: 44 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 20 },
  chip: {
    height: 32,
    paddingHorizontal: 13,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.glass.line45,
  },
  chipOn: {
    backgroundColor: colors.ink.onAccent,
    borderColor: colors.ink.onAccent,
  },
  chipLabel: { fontWeight: '600' },
  say: { fontWeight: '600', marginTop: 26, opacity: 0.78 },
  bigRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 4 },
  bigNumber: { fontWeight: '900', letterSpacing: -5, lineHeight: 92 },
  bigUnit: { fontWeight: '800', marginLeft: 6 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  pill: {
    height: 30,
    borderRadius: 15,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.glass.fill14,
  },
  pillPrimary: {
    backgroundColor: colors.ink.onAccent,
  },
  pillText: { fontWeight: '700' },
  chartHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 26 },
  chartCaption: { fontWeight: '700', opacity: 0.78, flex: 1, marginRight: 8 },
  chartToggle: { flexDirection: 'row', gap: 4 },
  chartToggleItem: {
    width: 34,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartToggleOn: { backgroundColor: colors.ink.onAccent },
  chartArea: { width: '100%', height: 148, marginTop: 6 },
  bars: { flex: 1, flexDirection: 'row', alignItems: 'flex-end' },
  barColumn: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  dayLabel: { marginTop: 6, height: 16, textAlign: 'center' },
  hourLabel: { maxWidth: '100%' },
  lineWrap: { flex: 1 },
  axisEndRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  page: { paddingHorizontal: 20, paddingBottom: 72 },
  eyebrow: { fontWeight: '700', letterSpacing: 1.4, marginTop: 30 },
  h2: { fontWeight: '800', marginTop: 4 },
  no1: { flexDirection: 'row', gap: 16, alignItems: 'flex-end', marginTop: 16 },
  no1Cover: {
    width: 128,
    height: 128,
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow.card,
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 14 },
    elevation: 4,
  },
  no1CoverImage: { width: 128, height: 128, borderRadius: 18 },
  no1Rank: { fontWeight: '900', letterSpacing: -2, lineHeight: 44 },
  no1Name: { fontWeight: '800', marginTop: 6 },
  no1Sub: { marginTop: 4 },
  no1Meta: { fontWeight: '700', marginTop: 10 },
  songList: { marginTop: 12 },
  songRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  songRank: { width: 26, fontWeight: '800' },
  songCover: {
    width: 44,
    height: 44,
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  songCoverImage: { width: 44, height: 44, borderRadius: 10 },
  songInfo: { flex: 1, minWidth: 0, marginLeft: 12 },
  songTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  songName: { fontWeight: '700', flex: 1 },
  songDur: { fontWeight: '700' },
  songArtist: { marginTop: 2 },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line.divider,
    marginTop: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent.primary,
  },
  artistHero: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 16 },
  artistHeroLabel: { fontWeight: '800' },
  artistHeroName: { fontWeight: '800', marginTop: 2 },
  artistHeroMeta: { marginTop: 4 },
  artistGrid: { flexDirection: 'row', marginTop: 20, gap: 8 },
  artistCell: { flex: 1, alignItems: 'center' },
  artistCellName: { fontWeight: '700', marginTop: 7, textAlign: 'center' },
  artistCellMeta: { marginTop: 1, textAlign: 'center' },
  empty: { paddingVertical: 22, alignItems: 'center' },
  footnote: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 28 },
  footnoteText: { flex: 1, lineHeight: 18 },
})))

const ReplayChart = ({
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
  const width = measuredWidth || Math.max(1, windowWidth - scaleSizeW(40))
  const maxHeight = scaleSizeH(BAR_MAX)
  const plotHeight = maxHeight + scaleSizeH(10)
  const labelReserve = scaleSizeH(24)
  const { points, slotWidth } = buildStatsChartLayout(buckets, width, maxHeight, scaleSizeH(3))
  const barWidth = Math.min(scaleSizeW(16), Math.max(scaleSizeW(8), slotWidth * 0.55))
  const ink = colors.ink.onAccent
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
                  color={ink}
                  style={[styles.dayLabel, { opacity: 0.78 }, bucket.kind == 'hour2' ? styles.hourLabel : null]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >{label.text}</Text>
                )
              : <Text size={10} color={ink} style={styles.dayLabel}> </Text>}
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
            <Line x1={0} y1={plotHeight - 1} x2={width} y2={plotHeight - 1} stroke={ink} strokeWidth={1} opacity={0.3} />
            {polyline
              ? <Polyline points={polyline} fill="none" stroke={ink} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
              : null}
            {points.map(point => (
              <Circle
                key={point.bucket.start}
                cx={point.x}
                cy={point.y + scaleSizeH(4)}
                r={point.bucket.isCurrent ? 4.5 : 3}
                fill={point.bucket.isCurrent ? ink : colors.accent.primary}
                stroke={ink}
                strokeWidth={point.bucket.isCurrent ? 0 : 2}
              />
            ))}
          </Svg>
          {axisLabels}
          {range == 'today' ? <View style={styles.axisEndRow}><Text size={10} color={ink} style={{ opacity: 0.78 }}>{t('stats_hour_end')}</Text></View> : null}
        </View>
      </View>
    )
  }

  return (
    <View style={styles.chartArea} onLayout={onLayout}>
      <Svg width={width} height={plotHeight} viewBox={`0 0 ${width} ${plotHeight}`}>
        <Line x1={0} y1={plotHeight - 1} x2={width} y2={plotHeight - 1} stroke={ink} strokeWidth={1} opacity={0.3} />
        {points.map(({ bucket, empty, height, x }) => {
          const barHeight = empty ? scaleSizeH(3) : height
          const y = plotHeight - barHeight
          const label = !empty && bucket.isCurrent
            ? (bucket.minutes > 0 ? `${bucket.minutes}${t('stats_unit_minute')}` : t('stats_minute_less_than_one'))
            : null
          return (
            <Fragment key={bucket.start}>
              {label
                ? <SvgText x={x} y={Math.max(12, y - 8)} fill={ink} fontSize={11} fontWeight="700" textAnchor="middle">{label}</SvgText>
                : null}
              <Rect
                x={x - barWidth / 2}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={empty ? scaleSizeW(1.5) : scaleSizeW(8)}
                fill={ink}
                opacity={empty ? 0.25 : bucket.isCurrent ? 1 : 0.45}
              />
            </Fragment>
          )
        })}
      </Svg>
      {axisLabels}
      {range == 'today' ? <View style={styles.axisEndRow}><Text size={10} color={ink} style={{ opacity: 0.78 }}>{t('stats_hour_end')}</Text></View> : null}
    </View>
  )
}

const SongBlock = ({
  styles,
  colors,
  songs,
  totalListenedMs,
  range,
  durationParts,
  t,
  onPlay,
}: {
  styles: ReturnType<typeof useStyles>
  colors: LuxColors
  songs: RankedSong[]
  totalListenedMs: number
  range: PlayRangeId
  durationParts: (ms: number) => { value: string, unit: string }
  t: (key: string, params?: Record<string, string | number>) => string
  onPlay: (song: PlayHistorySong) => void
}) => {
  if (!songs.length) {
    return <View style={styles.empty}><Text size={13} color={colors.ink.meta}>{t('stats_empty')}</Text></View>
  }
  const top = songs[0]
  const topParts = durationParts(top.listenedMs)
  const topPercent = totalListenedMs > 0 ? Math.round(top.listenedMs / totalListenedMs * 100) : 0
  const restMax = Math.max(...songs.slice(1).map(song => song.listenedMs), 1)
  return (
    <>
      <TouchableOpacity style={styles.no1} activeOpacity={0.85} onPress={() => { onPlay(top.song) }}>
        <View style={[styles.no1Cover, { backgroundColor: colors.playlistCovers[0].surface }]}>
          {top.song.img
            ? <Image style={styles.no1CoverImage} url={top.song.img} />
            : <MdiIcon name="music-note" size={40} color={colors.playlistCovers[0].accent} />}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text size={44} color={colors.accent.primary} style={styles.no1Rank}>{t('stats_replay_rank1')}</Text>
          <Text size={24} color={colors.ink.pageTitle} style={styles.no1Name} numberOfLines={2}>{top.song.name}</Text>
          <Text size={13} color={colors.ink.secondary} style={styles.no1Sub} numberOfLines={1}>{top.song.singer}</Text>
          <Text size={13} color={colors.ink.strong} style={styles.no1Meta}>
            {t('stats_share_inline', {
              duration: `${topParts.value}${topParts.unit}`,
              period: t(sharePeriodKey[range]),
              percent: topPercent,
            })}
          </Text>
        </View>
      </TouchableOpacity>
      <View style={styles.songList}>
        {songs.slice(1).map((song, index) => {
          const parts = durationParts(song.listenedMs)
          const ratio = Math.max(0.08, song.listenedMs / restMax)
          return (
            <TouchableOpacity key={song.key} style={styles.songRow} activeOpacity={0.85} onPress={() => { onPlay(song.song) }}>
              <Text size={15} color={colors.ink.faint} style={styles.songRank}>{index + 2}</Text>
              <View style={[styles.songCover, { backgroundColor: colors.playlistCovers[(index + 1) % colors.playlistCovers.length].surface }]}>
                {song.song.img
                  ? <Image style={styles.songCoverImage} url={song.song.img} />
                  : <MdiIcon name="music-note" size={18} color={colors.playlistCovers[(index + 1) % colors.playlistCovers.length].accent} />}
              </View>
              <View style={styles.songInfo}>
                <View style={styles.songTop}>
                  <Text size={15} color={colors.ink.strong} style={styles.songName} numberOfLines={1}>{song.song.name}</Text>
                  <Text size={13} color={colors.ink.strong} style={styles.songDur}>{parts.value}{parts.unit}</Text>
                </View>
                <Text size={12} color={colors.ink.secondary} style={styles.songArtist} numberOfLines={1}>{song.song.singer}</Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.round(ratio * 100)}%` }]} />
                </View>
              </View>
            </TouchableOpacity>
          )
        })}
      </View>
    </>
  )
}

const ArtistBlock = ({
  styles,
  colors,
  artists,
  totalListenedMs,
  range,
  durationParts,
  t,
}: {
  styles: ReturnType<typeof useStyles>
  colors: LuxColors
  artists: RankedArtist[]
  totalListenedMs: number
  range: PlayRangeId
  durationParts: (ms: number) => { value: string, unit: string }
  t: (key: string, params?: Record<string, string | number>) => string
}) => {
  if (!artists.length) {
    return <View style={styles.empty}><Text size={13} color={colors.ink.meta}>{t('stats_empty')}</Text></View>
  }
  const top = artists[0]
  const topParts = durationParts(top.listenedMs)
  const topPercent = totalListenedMs > 0 ? Math.round(top.listenedMs / totalListenedMs * 100) : 0
  const rest = artists.slice(1, 5)
  return (
    <>
      <View style={styles.artistHero}>
        <ArtistFace name={top.name} fallback={top.fallbackImg} size={96} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text size={13} color={colors.accent.primary} style={styles.artistHeroLabel}>{t('stats_replay_rank1_artist')}</Text>
          <Text size={20} color={colors.ink.pageTitle} style={styles.artistHeroName} numberOfLines={1}>{top.name}</Text>
          <Text size={13} color={colors.ink.secondary} style={styles.artistHeroMeta}>
            {t('stats_share_inline', {
              duration: `${topParts.value}${topParts.unit}`,
              period: t(sharePeriodKey[range]),
              percent: topPercent,
            })}
          </Text>
        </View>
      </View>
      {rest.length
        ? (
          <View style={styles.artistGrid}>
            {rest.map((artist, index) => {
              const parts = durationParts(artist.listenedMs)
              return (
                <View key={artist.name} style={styles.artistCell}>
                  <ArtistFace name={artist.name} fallback={artist.fallbackImg} size={60} />
                  <Text size={12} color={colors.ink.strong} style={styles.artistCellName} numberOfLines={1}>
                    {t('stats_replay_artist_cell', { rank: index + 2, name: artist.name })}
                  </Text>
                  <Text size={11} color={colors.ink.secondary} style={styles.artistCellMeta}>{parts.value}{parts.unit}</Text>
                </View>
              )
            })}
          </View>
          )
        : null}
    </>
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
  const statusBarHeight = useStatusbarHeight()
  const ink = colors.ink.onAccent
  const {
    t, range, setRange, luxSync, chartMode, onChartModeChange, stats, songs, artists,
    hours, minutes, totalMinutes, compareDiffMinutes, peakBucket, dailyAvgMs, durationText, durationParts, playSong,
  } = model

  const displayValue = hours > 0 ? hours : totalMinutes
  const displayUnit = hours > 0
    ? (minutes > 0
        ? t('stats_replay_unit_hm', { minutes })
        : t('stats_replay_unit_h'))
    : t('stats_replay_unit_m')

  let compare: { up: boolean, flat: boolean, text: string } | null = null
  if (compareDiffMinutes != null) {
    const flat = compareDiffMinutes == 0
    const delta = `${compareDiffMinutes > 0 ? '+' : '-'}${durationText(Math.abs(compareDiffMinutes) * 60_000, false)}`
    compare = {
      up: compareDiffMinutes >= 0,
      flat,
      text: flat
        ? t('stats_compare_flat')
        : t('stats_replay_compare', {
          label: t(compareLabelKey[range as Exclude<PlayRangeId, 'all'>]),
          delta,
        }),
    }
  }

  const chartCaption = (() => {
    if (!peakBucket || peakBucket.listenedMs <= 0) {
      return range == 'today' ? t('stats_replay_chart_idle_today') : t('stats_daily_title')
    }
    if (peakBucket.kind == 'hour2') {
      return t('stats_replay_chart_peak_today', { start: peakBucket.hour, end: peakBucket.hour + 2 })
    }
    if (peakBucket.kind == 'day') {
      return t('stats_replay_chart_peak_day', { label: statsBucketLabel(peakBucket, range, t).text })
    }
    if (peakBucket.kind == 'month') {
      return t('stats_replay_chart_peak_month', { month: peakBucket.month + 1 })
    }
    return t('stats_replay_chart_peak_year', { year: peakBucket.year })
  })()

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingBottom: 72 + bottomPadding }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.hero, { paddingTop: statusBarHeight }]}>
        <View style={styles.heroBlob} />
        <View style={styles.heroInner}>
          <View style={styles.nav}>
            <TouchableOpacity style={styles.back} activeOpacity={0.82} onPress={onClose}>
              <MdiIcon name="chevron-left" rawSize={24} color={ink} />
            </TouchableOpacity>
            <Text size={17} color={ink} style={styles.title}>{t('stats_title')}</Text>
            <View style={styles.navSpacer} />
          </View>

          <View style={styles.chips}>
            {RANGES.map(id => {
              const selected = id == range
              return (
                <TouchableOpacity
                  key={id}
                  style={[styles.chip, selected ? styles.chipOn : null]}
                  activeOpacity={0.85}
                  onPress={() => { setRange(id) }}
                >
                  <Text
                    size={13}
                    color={selected ? colors.accent.primary : ink}
                    style={styles.chipLabel}
                  >{t(rangeLabelKey[id])}</Text>
                </TouchableOpacity>
              )
            })}
          </View>

          <Text size={15} color={ink} style={styles.say}>{t(replayLeadKey[range])}</Text>
          <View style={styles.bigRow}>
            <Text size={96} color={ink} style={styles.bigNumber}>{displayValue}</Text>
            <Text size={26} color={ink} style={styles.bigUnit}>{displayUnit}</Text>
          </View>

          <View style={styles.metaRow}>
            {compare
              ? (
                <View style={[styles.pill, styles.pillPrimary]}>
                  {compare.flat ? null : <MdiIcon name={compare.up ? 'arrow-up' : 'arrow-down'} rawSize={14} color={colors.accent.primary} />}
                  <Text size={13} color={colors.accent.primary} style={styles.pillText}>{compare.text}</Text>
                </View>
                )
              : null}
            <View style={styles.pill}>
              <Text size={13} color={ink} style={styles.pillText}>
                {t('stats_daily_avg', { duration: durationText(dailyAvgMs, false) })}
              </Text>
            </View>
          </View>

          <View style={styles.chartHead}>
            <Text size={13} color={ink} style={styles.chartCaption} numberOfLines={1}>{chartCaption}</Text>
            <View style={styles.chartToggle}>
              <TouchableOpacity
                style={[styles.chartToggleItem, chartMode == 'bar' ? styles.chartToggleOn : null]}
                activeOpacity={0.85}
                onPress={() => { onChartModeChange('bar') }}
                accessibilityLabel={t('stats_chart_bar')}
              >
                <MdiIcon name="chart-bar" rawSize={16} color={chartMode == 'bar' ? colors.accent.primary : ink} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chartToggleItem, chartMode == 'line' ? styles.chartToggleOn : null]}
                activeOpacity={0.85}
                onPress={() => { onChartModeChange('line') }}
                accessibilityLabel={t('stats_chart_line')}
              >
                <MdiIcon name="chart-line" rawSize={16} color={chartMode == 'line' ? colors.accent.primary : ink} />
              </TouchableOpacity>
            </View>
          </View>
          <ReplayChart buckets={stats.chart} range={range} mode={chartMode} styles={styles} colors={colors} t={t} />
        </View>
      </View>

      <View style={styles.page}>
        <Text size={11} color={colors.ink.eyebrow} style={styles.eyebrow}>{t('stats_top_songs')}</Text>
        <Text size={22} color={colors.ink.pageTitle} style={styles.h2}>{t(replaySongsTitleKey[range])}</Text>
        <SongBlock
          styles={styles}
          colors={colors}
          songs={songs}
          totalListenedMs={stats.listenedMs}
          range={range}
          durationParts={durationParts}
          t={t}
          onPlay={playSong}
        />

        <Text size={11} color={colors.ink.eyebrow} style={[styles.eyebrow, { marginTop: 28 }]}>{t('stats_top_artists')}</Text>
        <Text size={22} color={colors.ink.pageTitle} style={styles.h2}>{t('stats_replay_artists_title')}</Text>
        <ArtistBlock
          styles={styles}
          colors={colors}
          artists={artists}
          totalListenedMs={stats.listenedMs}
          range={range}
          durationParts={durationParts}
          t={t}
        />

        <View style={styles.footnote}>
          <MdiIcon name="information-outline" rawSize={14} color={colors.ink.faint} />
          <Text size={12} color={colors.ink.faint} style={styles.footnoteText}>
            {t('stats_footnote_rule')}{luxSync ? t('stats_footnote_lux') : t('stats_footnote_local')}
          </Text>
        </View>
      </View>
    </ScrollView>
  )
}
