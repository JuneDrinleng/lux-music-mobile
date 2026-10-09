/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { Fragment, useMemo, type ReactNode } from 'react'
import {
  ScrollView,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native'
import Svg, { Circle, Line, Rect, Text as SvgText } from 'react-native-svg'

import Image from '@/components/common/Image'
import { MdiIcon } from '@/components/common/MdiIcon'
import Text from '@/components/common/Text'
import {
  BackButton,
  DeltaPill,
  Hairline,
  RankNumber,
  SourceTag,
} from '@/components/magazine'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import {
  PAGE_GUTTER,
  TOP_BAR_MARGIN_TOP,
  magType,
} from '@/theme/magazineType'
import { useStatusbarHeight } from '@/store/common/hook'
import { buildStatsChartLayout } from '@/utils/playHistory/chartLayout'
import {
  buildRangeStats,
  recordInBounds,
  startOfLocalDay,
  type ChartBucket,
  type RankedArtist,
  type RankedSong,
  type RangeBounds,
} from '@/utils/playHistory/range'
import { buildReplayAggregations, replayRhythmBuckets } from '@/utils/playHistory/replayAggregations'
import { type PlayRecord } from '@/utils/playHistory/types'
import { formatMinutes } from '@/utils/formatMinutes'
import { scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'
import { createStyle } from '@/utils/tools'

import { ArtistFace } from './ArtistFace'
import { type ListeningStatsModel } from './useListeningStatsModel'
import {
  sharePeriodKey,
  weekdayKey,
} from './statsShared'

/** Annual-report style is always the current calendar year (local). */
const REPLAY_RANGE = 'year' as const
const DAY_MS = 24 * 60 * 60 * 1000
const TOP_N = 5

/** Previous calendar year, same day-of-year window (Jan 1 → “today” last year). */
const previousYearSamePeriodBounds = (now: number): RangeBounds => {
  const date = new Date(now)
  const prevAnchor = new Date(date)
  prevAnchor.setFullYear(date.getFullYear() - 1)
  return {
    start: new Date(date.getFullYear() - 1, 0, 1).getTime(),
    end: startOfLocalDay(prevAnchor.getTime()) + DAY_MS,
  }
}

const sumListenedMs = (records: readonly PlayRecord[], bounds: RangeBounds): number => {
  let listenedMs = 0
  for (const record of records) {
    if (recordInBounds(record, bounds)) listenedMs += record.listenedMs
  }
  return listenedMs
}

type StoryBgRole = 'accent' | 'paper' | 'ink' | 'accentSoft'

type ReplayStoryId =
  | 'cover'
  | 'topSong'
  | 'topArtist'
  | 'topLists'
  | 'timeOfDay'
  | 'rhythm'
  | 'sources'
  | 'closing'

const STORY_BG_CYCLE: StoryBgRole[] = ['accent', 'paper', 'ink', 'accentSoft']

const MIN_RANK_SONGS = 3
const BAR_MAX = 96
const RADIAL_SIZE = 228

const useStyles = sharedLuxStyles(() => (createStyle({
  root: { flex: 1 },
  chrome: { paddingHorizontal: PAGE_GUTTER },
  topRow: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: TOP_BAR_MARGIN_TOP,
    marginBottom: 12,
  },
  scroll: { flex: 1 },
  section: {
    width: '100%',
    paddingHorizontal: PAGE_GUTTER,
    paddingTop: 22,
    paddingBottom: 36,
  },
  vinylWrap: { position: 'absolute', right: -48, top: 40, opacity: 0.35 },
  vinylOuter: { width: 220, height: 220, borderRadius: 110, borderWidth: 2 },
  vinylInner: { position: 'absolute', width: 72, height: 72, borderRadius: 36, borderWidth: 2, left: 74, top: 74 },
  coverTitle: { fontWeight: '800', letterSpacing: -0.5, lineHeight: 40 },
  heroNumber: { fontWeight: '800', letterSpacing: -4, lineHeight: 108, includeFontPadding: false, marginTop: 18 },
  heroUnit: { fontWeight: '800', marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 16 },
  metaText: { fontWeight: '600' },
  footerStats: { marginTop: 34, gap: 10 },
  footerLine: { fontWeight: '700' },
  screenEyebrow: { fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' },
  screenTitle: { fontWeight: '800', letterSpacing: -0.3, marginTop: 8, lineHeight: 30 },
  screenLead: { marginTop: 10, lineHeight: 22 },
  no1Cover: {
    width: '100%',
    maxWidth: 280,
    aspectRatio: 1,
    borderRadius: 6,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
    alignSelf: 'center',
  },
  no1CoverImage: { width: '100%', height: '100%', borderRadius: 6 },
  no1Name: { fontWeight: '800', marginTop: 18, letterSpacing: -0.3, textAlign: 'center' },
  no1Sub: { marginTop: 8, textAlign: 'center' },
  rankList: { marginTop: 22, gap: 0 },
  songRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  songName: { flex: 1, minWidth: 0, fontWeight: '700', marginLeft: 8 },
  songDur: { fontWeight: '800', marginLeft: 10, fontVariant: ['tabular-nums'] },
  artistHero: { alignItems: 'center', marginTop: 20 },
  artistName: { fontWeight: '800', marginTop: 16, letterSpacing: -0.3, textAlign: 'center' },
  artistMeta: { marginTop: 8, textAlign: 'center' },
  dualCol: { marginTop: 18, flexDirection: 'row', gap: 18 },
  dualBlock: { flex: 1, minWidth: 0 },
  blockLabel: { fontWeight: '700', letterSpacing: 1, marginBottom: 10 },
  radialWrap: { alignItems: 'center', marginTop: 8 },
  statLine: { marginTop: 16, fontWeight: '700' },
  chartArea: { width: '100%', height: 132, marginTop: 6 },
  weekdayRow: { flexDirection: 'row', alignItems: 'flex-end', height: 72, gap: 6, marginTop: 8 },
  weekdayCol: { flex: 1, alignItems: 'center' },
  weekdayBar: { width: '100%', borderRadius: 3 },
  weekdayLabel: { marginTop: 6, textAlign: 'center' },
  sourceRow: { marginTop: 14 },
  sourceHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sourceBarTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  sourceBarFill: { height: 8, borderRadius: 4 },
  closingBig: { fontWeight: '800', letterSpacing: -2, lineHeight: 56, marginTop: 12 },
  closingLine: { marginTop: 14, fontWeight: '600', lineHeight: 22 },
  empty: { paddingVertical: 22, alignItems: 'center' },
})))

const bgColor = (role: StoryBgRole, r: ReturnType<typeof magazineRoles>): string => {
  if (role === 'accent') return r.accent
  if (role === 'paper') return r.paper
  if (role === 'ink') return r.ink
  return r.accentSoft
}

const storyPalette = (role: StoryBgRole, r: ReturnType<typeof magazineRoles>) => {
  if (role === 'ink') {
    return {
      display: r.onInk,
      ink: r.onInk,
      muted: r.quiet,
      eyebrow: r.quiet,
      faint: r.quiet,
      bar: r.onInk,
      barMuted: r.hairline,
      barPeak: r.accent,
    }
  }
  if (role === 'accent') {
    return {
      display: r.onAccent,
      ink: r.onAccent,
      muted: r.onAccent,
      eyebrow: r.onAccent,
      faint: r.onAccent,
      bar: r.ink,
      barMuted: r.hairline,
      barPeak: r.ink,
    }
  }
  return {
    display: r.display,
    ink: r.ink,
    muted: r.muted,
    eyebrow: r.eyebrow,
    faint: r.faint,
    bar: r.ink,
    barMuted: r.hairline,
    barPeak: r.accent,
  }
}

const buildStoryOrder = (songCount: number): ReplayStoryId[] => {
  const pages: ReplayStoryId[] = ['cover']
  if (songCount >= MIN_RANK_SONGS) {
    pages.push('topSong', 'topArtist', 'topLists')
  }
  pages.push('timeOfDay', 'rhythm', 'sources', 'closing')
  return pages
}

const RhythmBars = ({
  buckets,
  palette,
  styles,
  width,
}: {
  buckets: ChartBucket[]
  palette: ReturnType<typeof storyPalette>
  styles: ReturnType<typeof useStyles>
  width: number
}) => {
  const maxHeight = scaleSizeH(BAR_MAX)
  const plotHeight = maxHeight + scaleSizeH(8)
  const { points, slotWidth } = buildStatsChartLayout(buckets, width, maxHeight, scaleSizeH(3))
  const barWidth = Math.min(scaleSizeW(14), Math.max(scaleSizeW(6), slotWidth * 0.52))
  let peakMs = 0
  for (const bucket of buckets) {
    if (bucket.listenedMs > peakMs) peakMs = bucket.listenedMs
  }

  return (
    <View style={styles.chartArea}>
      <Svg width={width} height={plotHeight} viewBox={`0 0 ${width} ${plotHeight}`}>
        <Line x1={0} y1={plotHeight - 1} x2={width} y2={plotHeight - 1} stroke={palette.bar} strokeWidth={1} opacity={0.35} />
        {points.map(({ bucket, empty, height, x }) => {
          const barHeight = empty ? scaleSizeH(3) : height
          const y = plotHeight - barHeight
          const peak = peakMs > 0 && bucket.listenedMs === peakMs
          const fill = empty ? palette.barMuted : peak ? palette.barPeak : palette.bar
          return (
            <Rect
              key={bucket.start}
              x={x - barWidth / 2}
              y={y}
              width={barWidth}
              height={barHeight}
              rx={scaleSizeW(2)}
              fill={fill}
              opacity={empty ? 0.55 : 1}
            />
          )
        })}
      </Svg>
    </View>
  )
}

const WeekdayBars = ({
  weekdayMs,
  palette,
  styles,
  t,
}: {
  weekdayMs: number[]
  palette: ReturnType<typeof storyPalette>
  styles: ReturnType<typeof useStyles>
  t: (key: string) => string
}) => {
  const peak = weekdayMs.reduce((m, v) => Math.max(m, v), 0)
  const maxBar = scaleSizeH(56)
  return (
    <View style={styles.weekdayRow}>
      {weekdayMs.map((ms, day) => {
        const h = peak > 0 ? Math.max(scaleSizeH(4), ms / peak * maxBar) : scaleSizeH(4)
        const isPeak = peak > 0 && ms === peak
        return (
          <View key={day} style={styles.weekdayCol}>
            <View
              style={[
                styles.weekdayBar,
                {
                  height: h,
                  backgroundColor: isPeak ? palette.barPeak : ms > 0 ? palette.bar : palette.barMuted,
                  opacity: ms > 0 ? 1 : 0.5,
                },
              ]}
            />
            <Text size={9} color={palette.eyebrow} style={styles.weekdayLabel} numberOfLines={1}>
              {t(weekdayKey[day])}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

const TimeRadial = ({
  slots,
  palette,
  styles,
}: {
  slots: ChartBucket[]
  palette: ReturnType<typeof storyPalette>
  styles: ReturnType<typeof useStyles>
}) => {
  const size = scaleSizeW(RADIAL_SIZE)
  const cx = size / 2
  const cy = size / 2
  const inner = size * 0.22
  const outerMax = size * 0.46
  const peak = slots.reduce((m, s) => Math.max(m, s.listenedMs), 0)

  return (
    <View style={styles.radialWrap}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={cx} cy={cy} r={inner} stroke={palette.barMuted} strokeWidth={1} fill="none" />
        {slots.map((slot, index) => {
          const angle = (index / 12) * Math.PI * 2 - Math.PI / 2
          const len = peak > 0 ? inner + (slot.listenedMs / peak) * (outerMax - inner) : inner
          const x2 = cx + Math.cos(angle) * len
          const y2 = cy + Math.sin(angle) * len
          const isPeak = peak > 0 && slot.listenedMs === peak
          return (
            <Line
              key={slot.start}
              x1={cx}
              y1={cy}
              x2={x2}
              y2={y2}
              stroke={isPeak ? palette.barPeak : slot.listenedMs > 0 ? palette.bar : palette.barMuted}
              strokeWidth={isPeak ? 3.5 : 2}
              strokeLinecap="round"
            />
          )
        })}
        {slots.map((slot, index) => {
          const angle = (index / 12) * Math.PI * 2 - Math.PI / 2
          const labelR = outerMax + scaleSizeW(10)
          const x = cx + Math.cos(angle) * labelR
          const y = cy + Math.sin(angle) * labelR
          return (
            <SvgText
              key={`lbl-${slot.start}`}
              x={x}
              y={y}
              fill={palette.eyebrow}
              fontSize={9}
              fontWeight="600"
              textAnchor="middle"
            >{slot.hour}</SvgText>
          )
        })}
      </Svg>
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
  const { width: windowWidth } = useWindowDimensions()

  const {
    t, luxSync, records, now,
    durationText, durationParts, playSong,
  } = model

  // Ignore magazine-style range tabs — annual report is always this calendar year.
  const stats = useMemo(() => buildRangeStats(records, REPLAY_RANGE, now), [now, records])
  const songs = useMemo(() => stats.songs.slice(0, TOP_N), [stats.songs])
  const artists = useMemo(() => stats.artists.slice(0, TOP_N), [stats.artists])
  const dailyAvgMs = stats.dayCount ? stats.listenedMs / stats.dayCount : 0

  const replay = useMemo(() => buildReplayAggregations(records, REPLAY_RANGE, now), [now, records])
  const storyOrder = useMemo(
    () => buildStoryOrder(replay.stats.songs.length),
    [replay.stats.songs.length],
  )

  const compare = useMemo(() => {
    const prevBounds = previousYearSamePeriodBounds(now)
    const previousListenedMs = sumListenedMs(records, prevBounds)
    if (previousListenedMs <= 0) return null
    const diff = Math.floor(stats.listenedMs / 60_000) - Math.floor(previousListenedMs / 60_000)
    return {
      up: diff >= 0,
      flat: diff == 0,
      delta: diff == 0
        ? t('stats_compare_flat')
        : durationText(Math.abs(diff) * 60_000, false),
      label: t('stats_compare_label_year_same_period'),
    }
  }, [durationText, now, records, stats.listenedMs, t])

  const rhythmBuckets = replayRhythmBuckets(replay.stats)
  const chartInnerWidth = windowWidth - scaleSizeW(PAGE_GUTTER * 2)

  const renderTopSong = (
    palette: ReturnType<typeof storyPalette>,
    top: RankedSong,
  ) => {
    const parts = durationParts(top.listenedMs)
    const percent = stats.listenedMs > 0 ? Math.round(top.listenedMs / stats.listenedMs * 100) : 0
    const coverTone = colors.playlistCovers[0]
    return (
      <>
        <Text size={magType.eyebrow.size} color={palette.eyebrow} style={styles.screenEyebrow}>
          {t('stats_replay_story_kicker_song')}
        </Text>
        <Text size={magType.section.size} color={palette.display} style={styles.screenTitle}>
          {t('stats_replay_story_headline_song')}
        </Text>
        <TouchableOpacity activeOpacity={0.85} onPress={() => { playSong(top.song) }}>
          <View style={[styles.no1Cover, { backgroundColor: coverTone.surface }]}>
            {top.song.img
              ? <Image style={styles.no1CoverImage} url={top.song.img} />
              : <MdiIcon name="music-note" size={48} color={coverTone.accent} />}
          </View>
          <Text size={magType.section.size} color={palette.display} style={styles.no1Name} numberOfLines={2}>
            {top.song.name}
          </Text>
          <Text size={magType.meta.size} color={palette.muted} style={styles.no1Sub} numberOfLines={2}>
            {top.song.singer} · {t('stats_share_inline', {
              duration: `${parts.value}${parts.unit}`,
              period: t(sharePeriodKey[REPLAY_RANGE]),
              percent,
            })}
          </Text>
          <Text size={magType.meta.size} color={palette.eyebrow} style={[styles.no1Sub, { marginTop: 4 }]}>
            {t('stats_replay_no1_plays', { count: top.playCount })}
          </Text>
        </TouchableOpacity>
      </>
    )
  }

  const renderTopArtist = (palette: ReturnType<typeof storyPalette>, top: RankedArtist) => {
    const parts = durationParts(top.listenedMs)
    return (
      <>
        <Text size={magType.eyebrow.size} color={palette.eyebrow} style={styles.screenEyebrow}>
          {t('stats_replay_story_kicker_artist')}
        </Text>
        <Text size={magType.section.size} color={palette.display} style={styles.screenTitle}>
          {t('stats_replay_story_headline_artist')}
        </Text>
        <View style={styles.artistHero}>
          <ArtistFace name={top.name} fallback={top.fallbackImg} size={120} toneIndex={0} />
          <Text size={28} color={palette.display} style={styles.artistName} numberOfLines={2}>{top.name}</Text>
          <Text size={magType.meta.size} color={palette.muted} style={styles.artistMeta}>
            {parts.value}{parts.unit} · {t('stats_replay_no1_plays', { count: top.playCount })}
          </Text>
        </View>
      </>
    )
  }

  const renderTopLists = (palette: ReturnType<typeof storyPalette>) => {
    const topSongs = replay.stats.songs.slice(0, 5)
    const topArtists = replay.stats.artists.slice(0, 5)
    return (
      <>
        <Text size={magType.eyebrow.size} color={palette.eyebrow} style={styles.screenEyebrow}>
          {t('stats_replay_story_kicker_lists')}
        </Text>
        <Text size={magType.section.size} color={palette.display} style={styles.screenTitle}>
          {t('stats_replay_story_headline_lists')}
        </Text>
        <View style={styles.dualCol}>
          <View style={styles.dualBlock}>
            <Text size={magType.sectionMeta.size} color={palette.eyebrow} style={styles.blockLabel}>
              {t('stats_top_songs')}
            </Text>
            <View style={styles.rankList}>
              {topSongs.map((song, index) => {
                const parts = durationParts(song.listenedMs)
                return (
                  <Fragment key={song.key}>
                    {index > 0 ? <Hairline /> : null}
                    <TouchableOpacity style={styles.songRow} activeOpacity={0.85} onPress={() => { playSong(song.song) }}>
                      <RankNumber rank={index + 1} width={30} />
                      <Text size={13} color={palette.ink} style={styles.songName} numberOfLines={1}>{song.song.name}</Text>
                      <Text size={12} color={palette.ink} style={styles.songDur}>{parts.value}</Text>
                    </TouchableOpacity>
                  </Fragment>
                )
              })}
            </View>
          </View>
          <View style={styles.dualBlock}>
            <Text size={magType.sectionMeta.size} color={palette.eyebrow} style={styles.blockLabel}>
              {t('stats_top_artists')}
            </Text>
            <View style={styles.rankList}>
              {topArtists.map((artist, index) => {
                const mins = durationParts(artist.listenedMs)
                return (
                  <Fragment key={artist.name}>
                    {index > 0 ? <Hairline /> : null}
                    <View style={styles.songRow}>
                      <RankNumber rank={index + 1} width={30} />
                      <Text size={13} color={palette.ink} style={styles.songName} numberOfLines={1}>{artist.name}</Text>
                      <Text size={12} color={palette.ink} style={styles.songDur}>{mins.value}</Text>
                    </View>
                  </Fragment>
                )
              })}
            </View>
          </View>
        </View>
      </>
    )
  }

  const renderCover = (palette: ReturnType<typeof storyPalette>, bgRole: StoryBgRole) => {
    const dailyParts = durationParts(dailyAvgMs)
    return (
      <>
        {bgRole === 'accent'
          ? (
            <View style={styles.vinylWrap} pointerEvents="none">
              <View style={[styles.vinylOuter, { borderColor: palette.ink }]}>
                <View style={[styles.vinylInner, { borderColor: palette.ink }]} />
              </View>
            </View>
            )
          : null}
        <Text size={magType.eyebrow.size} color={palette.eyebrow} style={styles.screenEyebrow}>
          {t('stats_replay_story_kicker_cover')}
        </Text>
        <Text size={32} color={palette.display} style={styles.coverTitle}>
          {t('stats_replay_story_title_year', { year: replay.periodYear })}
        </Text>
        <Text size={96} color={palette.display} style={styles.heroNumber}>
          {formatMinutes(stats.listenedMs, true)}
        </Text>
        <Text size={26} color={palette.display} style={styles.heroUnit}>{t('stats_unit_minute')}</Text>
        {compare
          ? (
            <View style={styles.metaRow}>
              <DeltaPill
                label={compare.delta}
                direction={compare.flat ? 'none' : compare.up ? 'up' : 'down'}
              />
              <Text size={14} color={palette.muted} style={styles.metaText}>{compare.label}</Text>
            </View>
            )
          : null}
        <View style={styles.footerStats}>
          <Text size={15} color={palette.ink} style={styles.footerLine}>
            {t('stats_replay_story_footer_daily', { duration: `${dailyParts.value}${dailyParts.unit}` })}
          </Text>
          <Text size={15} color={palette.ink} style={styles.footerLine}>
            {t('stats_replay_story_footer_active', { count: replay.activeDays })}
          </Text>
          <Text size={15} color={palette.ink} style={styles.footerLine}>
            {t('stats_replay_story_footer_plays', { count: replay.playCount })}
          </Text>
        </View>
      </>
    )
  }

  const renderTimeOfDay = (palette: ReturnType<typeof storyPalette>) => {
    const lateParts = durationParts(replay.lateNightMs)
    return (
      <>
        <Text size={magType.eyebrow.size} color={palette.eyebrow} style={styles.screenEyebrow}>
          {t('stats_replay_story_kicker_time')}
        </Text>
        <Text size={magType.section.size} color={palette.display} style={styles.screenTitle}>
          {t('stats_replay_story_headline_time')}
        </Text>
        <TimeRadial slots={replay.hour2Slots} palette={palette} styles={styles} />
        <Text size={14} color={palette.ink} style={styles.statLine}>
          {t('stats_replay_story_late_night', { duration: `${lateParts.value}${lateParts.unit}` })}
        </Text>
        {replay.busiestWeekday != null
          ? (
            <Text size={14} color={palette.muted} style={styles.statLine}>
              {t('stats_replay_story_busiest_day', { day: t(weekdayKey[replay.busiestWeekday]) })}
            </Text>
            )
          : null}
      </>
    )
  }

  const renderRhythm = (palette: ReturnType<typeof storyPalette>) => (
    <>
      <Text size={magType.eyebrow.size} color={palette.eyebrow} style={styles.screenEyebrow}>
        {t('stats_replay_story_kicker_rhythm')}
      </Text>
      <Text size={magType.section.size} color={palette.display} style={styles.screenTitle}>
        {t('stats_replay_story_headline_rhythm_month')}
      </Text>
      <RhythmBars buckets={rhythmBuckets} palette={palette} styles={styles} width={chartInnerWidth} />
      <Text size={magType.sectionMeta.size} color={palette.eyebrow} style={[styles.blockLabel, { marginTop: 22 }]}>
        {t('stats_replay_story_weekday_label')}
      </Text>
      <WeekdayBars weekdayMs={replay.weekdayMs} palette={palette} styles={styles} t={t} />
    </>
  )

  const sourceLabel = (source: string) => {
    const shortKey = `source_short_${source.toLowerCase()}`
    const translated = t(shortKey as 'source_short_kg')
    return translated !== shortKey ? translated : source.toUpperCase()
  }

  const renderSources = (palette: ReturnType<typeof storyPalette>) => {
    const rows = replay.sources.slice(0, 6)
    if (!rows.length) {
      return (
        <View style={styles.empty}>
          <Text size={13} color={palette.muted}>{t('stats_empty')}</Text>
        </View>
      )
    }
    return (
      <>
        <Text size={magType.eyebrow.size} color={palette.eyebrow} style={styles.screenEyebrow}>
          {t('stats_replay_story_kicker_sources')}
        </Text>
        <Text size={magType.section.size} color={palette.display} style={styles.screenTitle}>
          {t('stats_replay_story_headline_sources')}
        </Text>
        {rows.map(row => {
          const parts = durationParts(row.listenedMs)
          return (
            <View key={row.source} style={styles.sourceRow}>
              <View style={styles.sourceHead}>
                <SourceTag source={row.source} label={sourceLabel(row.source)} />
                <Text size={13} color={palette.ink} style={{ fontWeight: '800' }}>
                  {parts.value}{parts.unit} · {row.percent}%
                </Text>
              </View>
              <View style={[styles.sourceBarTrack, { backgroundColor: palette.barMuted }]}>
                <View
                  style={[
                    styles.sourceBarFill,
                    { width: `${Math.max(row.percent, 4)}%`, backgroundColor: palette.barPeak },
                  ]}
                />
              </View>
            </View>
          )
        })}
      </>
    )
  }

  const renderClosing = (palette: ReturnType<typeof storyPalette>) => {
    const topSong = replay.stats.songs[0]
    const topArtist = replay.stats.artists[0]
    const total = formatMinutes(stats.listenedMs, true)
    return (
      <>
        <Text size={magType.eyebrow.size} color={palette.eyebrow} style={styles.screenEyebrow}>
          {t('stats_replay_story_kicker_closing')}
        </Text>
        <Text size={magType.section.size} color={palette.display} style={styles.screenTitle}>
          {t('stats_replay_story_headline_closing')}
        </Text>
        <Text size={48} color={palette.display} style={styles.closingBig}>
          {total}
        </Text>
        <Text size={magType.meta.size} color={palette.muted}>{t('stats_unit_minute')}</Text>
        <Text size={15} color={palette.ink} style={styles.closingLine}>
          {topSong
            ? t('stats_replay_story_closing_song', { name: topSong.song.name })
            : t('stats_empty')}
        </Text>
        <Text size={15} color={palette.ink} style={styles.closingLine}>
          {topArtist
            ? t('stats_replay_story_closing_artist', { name: topArtist.name })
            : ''}
        </Text>
        <Text size={13} color={palette.muted} style={[styles.closingLine, { marginTop: 22 }]}>
          {t('stats_footnote_rule')}{luxSync ? t('stats_footnote_lux') : t('stats_footnote_local')}
        </Text>
      </>
    )
  }

  const renderSectionBody = (id: ReplayStoryId, palette: ReturnType<typeof storyPalette>, bgRole: StoryBgRole) => {
    if (id === 'cover') return renderCover(palette, bgRole)
    if (id === 'topSong' && songs[0]) return renderTopSong(palette, songs[0])
    if (id === 'topArtist' && artists[0]) return renderTopArtist(palette, artists[0])
    if (id === 'topLists') return renderTopLists(palette)
    if (id === 'timeOfDay') return renderTimeOfDay(palette)
    if (id === 'rhythm') return renderRhythm(palette)
    if (id === 'sources') return renderSources(palette)
    if (id === 'closing') return renderClosing(palette)
    return null
  }

  return (
    <View style={[styles.root, { backgroundColor: r.paper, paddingTop: statusBarHeight, paddingBottom: bottomPadding }]}>
      <View style={styles.chrome}>
        <View style={styles.topRow}>
          <BackButton onPress={onClose} />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
      >
        {storyOrder.map((id, index) => {
          const bgRole = STORY_BG_CYCLE[index % STORY_BG_CYCLE.length]
          const palette = storyPalette(bgRole, r)
          const backgroundColor = bgColor(bgRole, r)
          const body: ReactNode = renderSectionBody(id, palette, bgRole)
          return (
            <View key={id} style={[styles.section, { backgroundColor }]}>
              {body}
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}
