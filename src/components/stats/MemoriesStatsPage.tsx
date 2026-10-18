/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { useMemo } from 'react'
import { ScrollView, Share, TouchableOpacity, View } from 'react-native'

import Image from '@/components/common/Image'
import Text from '@/components/common/Text'
import { BackButton, Hairline, SecondaryButton, TextTabs } from '@/components/magazine'
import { useStatusbarHeight } from '@/store/common/hook'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { dateKey, localDateReader } from '@/utils/memories/calendar'
import { type Milestone } from '@/utils/memories/milestones'
import { monthAt, monthIndex, monthlyReport, type ReportMonth } from '@/utils/memories/monthly'
import { type MemoryTimelineEntry } from '@/utils/memories/timeline'
import { createStyle, toast } from '@/utils/tools'

import { rangeLabelKey } from './statsShared'
import { type ListeningStatsModel } from './useListeningStatsModel'
import { useMemoriesModel } from './useMemoriesModel'

const useStyles = sharedLuxStyles(() => createStyle({
  root: { flex: 1 },
  content: { paddingHorizontal: 22 },
  top: { height: 40, marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { marginTop: 6, fontWeight: '700', letterSpacing: 2 },
  heading: { fontWeight: '800', lineHeight: 38 },
  tabs: { marginTop: 10 },
  tab: { paddingTop: 8, paddingBottom: 8 },
  card: { marginTop: 16, borderTopWidth: 3, borderRadius: 6, padding: 14 },
  cardEyebrow: { fontWeight: '700', letterSpacing: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  memoryRow: { marginTop: 10 },
  cover: { width: 56, height: 56, borderRadius: 4, overflow: 'hidden' },
  copy: { flex: 1, minWidth: 0 },
  bold: { fontWeight: '800' },
  title: { fontWeight: '700' },
  sub: { marginTop: 2 },
  note: { marginTop: 8 },
  banner: { marginTop: 12, borderRadius: 6, paddingVertical: 12, paddingHorizontal: 14 },
  button: { paddingHorizontal: 14 },
  play: { height: 28, borderRadius: 15, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  rule: { height: 2, marginTop: 22, marginBottom: 12 },
  section: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  milestone: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  timeline: { marginTop: 14, paddingLeft: 24 },
  spine: { position: 'absolute', left: 6, top: 4, bottom: 0, width: 2 },
  group: { marginBottom: 16 },
  dot: { position: 'absolute', left: -23, top: 3, width: 12, height: 12, borderWidth: 2, borderRadius: 6 },
  event: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4, minHeight: 44 },
  eventCover: { width: 40, height: 40, borderRadius: 4, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  empty: { paddingVertical: 22 },
}))

export const MemoriesStatsPage = ({ model, timeline, onClose, onOpenMonthly, onOpenReplay, bottomPadding }: {
  model: ListeningStatsModel
  timeline: boolean
  onClose: () => void
  onOpenMonthly: (month?: ReportMonth) => void
  onOpenReplay: () => void
  bottomPadding: number
}) => {
  const styles = useStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const statusBarHeight = useStatusbarHeight()
  const { t, records, now, playSong, range, setRange } = model
  const memories = useMemoriesModel(model)
  const today = dateKey(localDateReader()(now))
  const report = useMemo(() => monthlyReport(records, monthAt(monthIndex(localDateReader()(now)) - 1), now), [records, now])
  const memory = memories.days[0]
  const favorite = memory?.songs[0]
  const title = (item: Milestone) => t(item.textKey, { count: item.threshold.toLocaleString(), days: item.threshold, hours: item.threshold, artist: item.artist ?? '' })
  const anniversaryTitle = (years: number) => years == 1 ? t('memories_last_year') : t('memories_years_ago', { years })
  const monthlyTitle = (month: number) => t('memories_monthly_title', { month })
  const reportSummary = (minutes: number, songs: number) => t('memories_report_summary', { minutes: minutes.toLocaleString(), songs: songs.toLocaleString() })
  const eventText = (entry: MemoryTimelineEntry) => {
    if (entry.kind == 'anniversary') {
      const song = entry.memory.songs[0]
      return { title: anniversaryTitle(entry.memory.yearsAgo), subtitle: t('memories_anniversary_summary', { years: entry.memory.yearsAgo, song: song.song.name, count: song.playCount }), song: song.song }
    }
    if (entry.kind == 'milestone') {
      const song = entry.milestone.song
      return { title: t('memories_milestone_title', { title: title(entry.milestone) }), subtitle: song && entry.milestone.kind != 'streak' ? t('memories_song_artist', { song: song.name, artist: song.singer }) : t('memories_reached'), song }
    }
    const best = entry.report.topSongs[0]
    return { title: monthlyTitle(entry.report.month), subtitle: t('memories_monthly_summary', { minutes: entry.report.minutes.toLocaleString(), song: best?.song.name ?? '' }), song: best?.song }
  }
  const share = () => {
    const message = memories.timeline.flatMap(group => [group.date, ...group.items.map(entry => {
      const text = eventText(entry)
      return `${text.title} · ${text.subtitle}`
    })]).join('\n')
    void Share.share({ message }).catch(() => { toast(t('memories_share_failed')) })
  }
  return (
    <ScrollView style={[styles.root, { backgroundColor: r.paper }]} contentContainerStyle={[styles.content, { paddingTop: statusBarHeight, paddingBottom: 26 + bottomPadding }]} showsVerticalScrollIndicator={false}>
      <View style={styles.top}>
        <BackButton compact onPress={onClose} accessibilityLabel={t('back')} />
        {timeline ? <SecondaryButton compact label={t('memories_share')} style={styles.button} onPress={share} disabled={!memories.timeline.length} /> : null}
      </View>
      <Text size={11} color={r.eyebrow} style={styles.eyebrow}>{t(timeline ? 'memories_eyebrow' : 'memories_stats_eyebrow')}</Text>
      <Text size={32} color={r.display} style={styles.heading}>{t(timeline ? 'memories_title' : 'stats_title')}</Text>
      {timeline
        ? <TextTabs style={styles.tabs} tabStyle={styles.tab} items={[{ id: 'timeline', label: t('memories_timeline') }, { id: 'monthly', label: t('monthly_entry') }, { id: 'replay', label: t('memories_annual_replay') }]} value="timeline" onChange={id => { if (id == 'monthly') onOpenMonthly(); else if (id == 'replay') onOpenReplay() }} />
        : <TextTabs style={styles.tabs} tabStyle={styles.tab} items={(['week', 'month', 'year', 'all'] as const).map(id => ({ id, label: t(rangeLabelKey[id]) }))} value={range} onChange={id => { setRange(id as 'week' | 'month' | 'year' | 'all') }} />}
      {timeline
        ? (
          <View style={styles.timeline}>
            {memories.timeline.length ? <View style={[styles.spine, { backgroundColor: r.ink }]} /> : <Text size={12} color={r.muted} style={styles.empty}>{t('memories_timeline_empty')}</Text>}
            {memories.timeline.map(group => (
              <View key={group.date} style={styles.group}>
                <View style={[styles.dot, { borderColor: r.ink, backgroundColor: group.date == today ? r.accent : r.paper }]} />
                <Text size={11} color={r.eyebrow} style={styles.cardEyebrow}>{group.date == today ? t('memories_today') : t(group.date.slice(0, 4) == today.slice(0, 4) ? 'stats_date_md' : 'memories_date', { year: group.date.slice(0, 4), month: Number(group.date.slice(5, 7)), day: Number(group.date.slice(8, 10)) })}</Text>
                {group.items.map(entry => {
                  const text = eventText(entry)
                  return (
                    <TouchableOpacity key={entry.id} activeOpacity={0.7} style={styles.event} accessibilityRole="button" onPress={() => { if (entry.kind == 'monthly') onOpenMonthly(entry.report); else if (text.song) playSong(text.song) }}>
                      {entry.kind == 'milestone' && entry.milestone.kind == 'streak'
                        ? <View style={[styles.eventCover, { backgroundColor: r.accent }]}><Text size={22} color={r.ink} style={styles.bold}>★</Text></View>
                        : <Image url={text.song?.img} style={styles.eventCover} />}
                      <View style={styles.copy}>
                        <Text size={15} color={r.list} style={styles.title}>{text.title}</Text>
                        <Text size={12} color={r.muted} style={styles.sub}>{text.subtitle}</Text>
                      </View>
                    </TouchableOpacity>
                  )
                })}
              </View>
            ))}
          </View>
          )
        : (
          <>
            <View style={[styles.card, { borderTopColor: r.ink, backgroundColor: r.paperRaised }]}>
              <Text size={11} color={r.eyebrow} style={styles.cardEyebrow}>{memory ? t('memories_day_heading', { title: anniversaryTitle(memory.yearsAgo), date: memory.date.replace(/-/g, '.') }) : t('memories_last_year')}</Text>
              {favorite && memory
                ? (
                  <>
                    <View style={[styles.row, styles.memoryRow]}>
                      <Image url={favorite.song.img} style={styles.cover} />
                      <View style={styles.copy}>
                        <Text size={17} color={r.ink} style={styles.bold}>{favorite.song.name}</Text>
                        <Text size={12} color={r.muted}>{t('memories_day_song', { artist: favorite.song.singer, count: favorite.playCount })}</Text>
                      </View>
                      <TouchableOpacity style={[styles.play, { backgroundColor: r.ink }]} hitSlop={8} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={t('memories_play')} onPress={() => { playSong(favorite.song) }}><Text size={13} color={r.onInk} style={styles.title}>{t('memories_play')}</Text></TouchableOpacity>
                    </View>
                    <Text size={12} color={r.muted} style={styles.note}>{t('memories_day_total', { minutes: memory.minutes })}{memory.songs.length > 1 ? t('memories_day_others', { songs: memory.songs.slice(1, 3).map(item => item.song.name).join(t('memories_separator')) }) : ''}</Text>
                  </>
                  )
                : <Text size={12} color={r.muted} style={styles.note}>{t('memories_day_empty')}</Text>}
            </View>
            <View style={[styles.banner, styles.row, { backgroundColor: r.accentSoft }]}>
              <View style={styles.copy}>
                <Text size={11} color={r.accentInk} style={styles.cardEyebrow}>{t('memories_report_ready', { month: report.month })}</Text>
                <Text size={15} color={r.ink} style={[styles.bold, styles.sub]}>{report.playCount ? reportSummary(report.minutes, report.songCount) : t('monthly_empty')}</Text>
              </View>
              <SecondaryButton compact label={t('memories_view')} style={styles.button} onPress={() => { onOpenMonthly(report) }} />
            </View>
            <View style={[styles.rule, { backgroundColor: r.ink }]} />
            <View style={styles.section}>
              <Text size={22} color={r.ink} style={styles.bold}>{t('memories_milestones')}</Text>
              <Text size={12} color={r.muted}>{t('memories_reached_count', { count: memories.milestones.filter(item => item.reachedAt != null).length, total: memories.milestones.length })}</Text>
            </View>
            {memories.milestones.map((item, index) => (
              <View key={item.id}>
                <TouchableOpacity style={styles.milestone} activeOpacity={0.7} onPress={() => { if (item.song) playSong(item.song) }} onLongPress={() => { memories.ignore(item.id) }} accessibilityRole="button" accessibilityHint={t('memories_ignore_hint')} accessibilityActions={[{ name: 'ignore', label: t('memories_ignore') }]} onAccessibilityAction={event => { if (event.nativeEvent.actionName == 'ignore') memories.ignore(item.id) }}>
                  <View style={[styles.badge, { backgroundColor: item.reachedAt != null ? r.accent : r.placeholder }]}><Text size={22} color={r.ink} style={styles.bold}>{item.reachedAt != null ? '★' : '☆'}</Text></View>
                  <View style={styles.copy}>
                    <Text size={15} color={r.list} style={styles.title}>{title(item)}</Text>
                    <Text size={12} color={r.muted} style={styles.sub}>{item.reachedAt != null ? t(item.kind == 'streak' ? 'memories_streak_date' : 'memories_milestone_date', { date: dateKey(localDateReader()(item.reachedAt)).replace(/-/g, '.'), song: item.song?.name ?? '' }) : t(`memories_remaining_${item.kind}`, { count: Math.ceil(item.remaining) })}</Text>
                  </View>
                  <Text size={12} color={r.muted} style={styles.title}>{item.reachedAt != null ? t('memories_reached') : `${Math.floor(item.progress * 100)}%`}</Text>
                </TouchableOpacity>
                {index < memories.milestones.length - 1 ? <Hairline /> : null}
              </View>
            ))}
            {!records.length ? <Text size={12} color={r.muted} style={styles.empty}>{t('memories_milestones_empty')}</Text> : null}
          </>
          )}
      {memories.failed ? <Text size={12} color={r.muted} style={styles.note}>{t('memories_save_failed')}</Text> : null}
    </ScrollView>
  )
}
