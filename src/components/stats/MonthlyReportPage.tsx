/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { useMemo, useState } from 'react'
import { ScrollView, Share, TouchableOpacity, View } from 'react-native'
import Svg, { Text as SvgText } from 'react-native-svg'

import Image from '@/components/common/Image'
import Text from '@/components/common/Text'
import { MdiIcon } from '@/components/common/MdiIcon'
import { BackButton, Hairline, SecondaryButton } from '@/components/magazine'
import { useStatusbarHeight } from '@/store/common/hook'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { localDateReader } from '@/utils/memories/calendar'
import { monthAt, monthIndex, monthlyBounds, monthlyReport, switchReportMonth, type ReportMonth } from '@/utils/memories/monthly'
import { createStyle } from '@/utils/tools'

import { type ListeningStatsModel } from './useListeningStatsModel'
import { ShareCardPage } from '@/components/shareCard/ShareCardPage'
import { buildRangeStats } from '@/utils/playHistory/range'

const useStyles = sharedLuxStyles(() => createStyle({
  root: { flex: 1 },
  content: { paddingHorizontal: 22 },
  top: { height: 40, marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  share: { paddingHorizontal: 14 },
  eyebrow: { marginTop: 6, fontWeight: '700', letterSpacing: 2 },
  month: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  arrow: { width: 16, height: 28, alignItems: 'center', justifyContent: 'center' },
  heading: { fontWeight: '800', lineHeight: 38, flexShrink: 1 },
  figureRow: { marginTop: 10, flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' },
  figure: { fontWeight: '800', lineHeight: 60, includeFontPadding: false },
  unit: { fontWeight: '700', marginLeft: 6 },
  delta: { marginLeft: 8, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  bold: { fontWeight: '700' },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 60, marginTop: 14 },
  column: { flex: 1 },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
  rule: { height: 2, marginTop: 22, marginBottom: 12 },
  section: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sectionTitle: { fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  rank: { width: 28, height: 30 },
  cover: { width: 40, height: 40, borderRadius: 4, overflow: 'hidden' },
  song: { flex: 1, minWidth: 0 },
  singer: { marginTop: 2 },
  discoveries: { marginTop: 4 },
  empty: { paddingVertical: 22 },
}))

/** 5A: the stats shell supplies history subscriptions, data-space isolation and Android back handling. */
export const MonthlyReportPage = ({ model, onClose, bottomPadding, initialMonth, onOpenStats }: {
  model: ListeningStatsModel
  onClose: () => void
  bottomPadding: number
  initialMonth?: ReportMonth
  onOpenStats?: () => void
}) => {
  const styles = useStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const statusBarHeight = useStatusbarHeight()
  const { records, now, t } = model
  const [selected, setSelected] = useState(() => monthIndex(initialMonth ?? localDateReader()(now)))
  const [preview, setPreview] = useState(false)
  const bounds = useMemo(() => monthlyBounds(records, now), [records, now])
  // Clamp on history deletion/import and data-space switches as well as button presses.
  const index = Math.max(bounds.min, Math.min(bounds.max, selected))
  const report = useMemo(() => monthlyReport(records, monthAt(index), now), [records, index, now])
  const previous = monthAt(index - 1)
  const monthLabel = t('monthly_month', { year: report.year, month: report.month })
  const summary = t('monthly_summary', { songs: report.songCount, artists: report.artistCount, hour: report.peakHour ?? 0 })
  const delta = report.changePercent == null
    ? t('monthly_no_previous', { month: previous.month })
    : t('monthly_comparison', { direction: report.changePercent > 0 ? '↑' : report.changePercent < 0 ? '↓' : '→', percent: Math.abs(report.changePercent), month: previous.month })
  const discovery = report.discoveries[0]
  const discoveriesText = discovery
    ? t('monthly_discovery_summary', { count: report.discoveries.length, song: discovery.song.name, plays: discovery.playCount })
    : t('monthly_no_discoveries')
  const peak = report.peakDay
  const peakLabel = peak ? t('monthly_peak', { month: report.month, day: peak.day, minutes: Math.round(peak.listenedMs / 60_000) }) : ''
  const maxMs = peak?.listenedMs ?? 1
  const share = async() => {
    const favorites = report.topSongs.map((item, i) => t('monthly_share_song', { rank: i + 1, song: item.song.name, artist: item.song.singer, count: item.playCount })).join('\n')
    await Share.share({ message: [monthLabel, `${report.minutes.toLocaleString()} ${t('stats_unit_minute')}`, delta, summary, t('monthly_favorites'), favorites, t('monthly_discoveries'), discoveriesText].join('\n') })
  }
  const annual = useMemo(() => buildRangeStats(records.filter(record => record.startedAt <= now), 'year', Math.min(now, new Date(report.year, 11, 31, 23, 59, 59).getTime())), [records, now, report.year])
  return (
    <>
    <ScrollView style={[styles.root, { backgroundColor: r.paper }]} contentContainerStyle={[styles.content, { paddingTop: statusBarHeight, paddingBottom: 26 + bottomPadding }]} showsVerticalScrollIndicator={false}>
      <View style={styles.top}>
        <BackButton compact onPress={onClose} accessibilityLabel={t('back')} />
        <SecondaryButton compact label={t('monthly_share')} style={styles.share} onPress={() => { setPreview(true) }} disabled={!report.playCount} />
      </View>
      <Text size={11} color={r.eyebrow} style={styles.eyebrow}>{t('monthly_eyebrow')}</Text>
      <View style={styles.month}>
        <TouchableOpacity style={styles.arrow} hitSlop={{ top: 8, bottom: 8, left: 14, right: 14 }} accessibilityRole="button" accessibilityLabel={t('monthly_previous')} accessibilityState={{ disabled: index <= bounds.min }} disabled={index <= bounds.min} onPress={() => { setSelected(monthIndex(switchReportMonth(report, -1, bounds))) }}>
          <MdiIcon name="chevron-left" size={22} color={r.quiet} />
        </TouchableOpacity>
        <Text size={32} color={r.display} style={styles.heading}>{monthLabel}</Text>
        <TouchableOpacity style={styles.arrow} hitSlop={{ top: 8, bottom: 8, left: 14, right: 14 }} accessibilityRole="button" accessibilityLabel={t('monthly_next')} accessibilityState={{ disabled: index >= bounds.max }} disabled={index >= bounds.max} onPress={() => { setSelected(monthIndex(switchReportMonth(report, 1, bounds))) }}>
          <MdiIcon name="chevron-right" size={22} color={r.quiet} />
        </TouchableOpacity>
      </View>
      <View style={styles.figureRow}>
        <Text size={56} color={r.ink} style={styles.figure}>{report.minutes.toLocaleString()}</Text>
        <Text size={15} color={r.ink} style={styles.unit}>{t('stats_unit_minute')}</Text>
        <View style={[styles.delta, { backgroundColor: r.ink }]}><Text size={12} color={r.onInk} style={styles.bold}>{delta}</Text></View>
      </View>
      <Text size={12} color={r.muted}>{report.playCount ? summary : t('monthly_empty')}</Text>
      <View style={styles.chart}>
        {report.days.map(day => (
          <View key={day.day} accessible accessibilityLabel={t('monthly_day', { month: report.month, day: day.day, minutes: Math.round(day.listenedMs / 60_000) })} style={[styles.column, { height: `${day.listenedMs / maxMs * 100}%`, backgroundColor: day.day == peak?.day ? r.accent : r.ink }]} />
        ))}
      </View>
      <View style={styles.axis}>
        <Text size={12} color={r.muted}>{t('stats_date_md', { month: report.month, day: 1 })}</Text>
        <Text size={12} color={r.muted}>{peakLabel}</Text>
        <Text size={12} color={r.muted}>{t('stats_date_md', { month: report.month, day: report.days.length })}</Text>
      </View>
      <View style={[styles.rule, { backgroundColor: r.ink }]} />
      <View style={styles.section}>
        <Text size={22} color={r.ink} style={styles.sectionTitle}>{t('monthly_favorites')}</Text>
        <Text size={12} color={r.muted}>{t('monthly_by_plays')}</Text>
      </View>
      {report.topSongs.map((item, i) => (
        <View key={item.key}>
          <View style={styles.row}>
            <View style={styles.rank}>
              <Svg width="100%" height="100%" viewBox="0 0 28 30"><SvgText x={0} y={23} fontSize={22} fontWeight="800" fill="none" stroke={r.ink} strokeWidth={1}>{String(i + 1).padStart(2, '0')}</SvgText></Svg>
            </View>
            <Image url={item.song.img} style={styles.cover} />
            <View style={styles.song}>
              <Text size={15} color={r.list} style={styles.bold} numberOfLines={1}>{item.song.name}</Text>
              <Text size={12} color={r.muted} style={styles.singer} numberOfLines={1}>{item.song.singer}</Text>
            </View>
            <Text size={12} color={r.muted}>{t('monthly_plays', { count: item.playCount })}</Text>
          </View>
          <Hairline />
        </View>
      ))}
      {!report.playCount ? <Text size={12} color={r.muted} style={styles.empty}>{t('monthly_empty_hint')}</Text> : null}
      <View style={[styles.rule, { backgroundColor: r.ink }]} />
      <Text size={22} color={r.ink} style={styles.sectionTitle}>{t('monthly_discoveries')}</Text>
      <Text size={12} color={r.muted} style={styles.discoveries}>{discoveriesText}</Text>
      {onOpenStats ? <View style={styles.empty}><SecondaryButton compact label={t('memories_stats_details')} onPress={onOpenStats} /></View> : null}
    </ScrollView>
    {preview ? <ShareCardPage initialTab="monthly" onClose={() => { setPreview(false) }} monthlyFallback={share} sources={{
      monthly: { title: monthLabel, minutes: report.minutes, playCount: report.playCount, songCount: report.songCount, artistCount: report.artistCount, topSongs: report.topSongs.map(item => ({ name: item.song.name, singer: item.song.singer, playCount: item.playCount })) },
      annual: { title: t('share_card_annual_title', { year: report.year }), minutes: Math.round(annual.listenedMs / 60_000), playCount: annual.songs.reduce((sum, song) => sum + song.playCount, 0), songCount: annual.songs.length, artistCount: annual.artists.length, topSongs: annual.songs.slice(0, 3).map(item => ({ name: item.song.name, singer: item.song.singer, playCount: item.playCount })) },
    }} /> : null}
    </>
  )
}
