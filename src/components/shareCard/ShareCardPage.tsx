/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Modal, Platform, ScrollView, View } from 'react-native'
import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import { BackButton, MagSegmented, PrimaryButton, SecondaryButton, TextButton, TextTabs } from '@/components/magazine'
import { useI18n } from '@/lang'
import { useStatusbarHeight } from '@/store/common/hook'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { getUserName } from '@/utils/data'
import { getActiveSpace, onDataSpaceWillChange } from '@/utils/dataSpace'
import { captureAndShareCard, nativeCardExport } from '@/utils/shareCard/export'
import { buildShareCard, initialShareCardOptions, SHARE_CARD_BACKGROUNDS, SHARE_CARD_TABS, type ShareCardSources, type ShareCardTab, type ShareCardBackground } from '@/utils/shareCard/model'
import { createStyle, requestStoragePermission, toast } from '@/utils/tools'
import { saveShareCard } from '@/utils/nativeModules/utils'
import { getPlayRecords, subscribePlayHistory } from '@/utils/playHistory/store'
import { monthlyReport } from '@/utils/memories/monthly'
import { buildRangeStats } from '@/utils/playHistory/range'

const useStyles = sharedLuxStyles(() => createStyle({
  root: { flex: 1 },
  body: { paddingHorizontal: 22, paddingBottom: 28 },
  top: { height: 40, marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { fontWeight: '700', letterSpacing: 2, marginTop: 6 },
  title: { fontWeight: '800', lineHeight: 38 },
  tabs: { marginTop: 10 },
  card: { width: 300, borderRadius: 6, borderTopWidth: 3, padding: 22, marginTop: 18, alignSelf: 'center' },
  song: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cover: { width: 44, height: 44, borderRadius: 4 },
  songText: { flex: 1 },
  bold: { fontWeight: '800' },
  lyrics: { marginVertical: 22 },
  lyric: { fontWeight: '800', lineHeight: 34 },
  translation: { lineHeight: 18 },
  watermark: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 20, paddingTop: 10, borderTopWidth: 1 },
  brand: { fontWeight: '700', letterSpacing: 2 },
  backgrounds: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, flexWrap: 'wrap' },
  toggles: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  toggle: { paddingHorizontal: 13 },
  footer: { flexDirection: 'row', gap: 16, paddingHorizontal: 22, paddingTop: 12, paddingBottom: 26 },
  primary: { flex: 1 },
  report: { marginTop: 22, gap: 8 },
  figure: { fontWeight: '800', lineHeight: 60 },
  empty: { paddingVertical: 30 },
}))

/** A full-page modal keeps Android back local and preserves the underlying player/report. */
export const ShareCardPage = ({ sources, initialTab, onClose, monthlyFallback }: {
  sources: ShareCardSources
  initialTab: ShareCardTab
  onClose: () => void
  monthlyFallback?: () => Promise<void>
}) => {
  const styles = useStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const t = useI18n()
  const statusBarHeight = useStatusbarHeight()
  const [options, setOptions] = useState(() => initialShareCardOptions(initialTab))
  const [nickname, setNickname] = useState('')
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const cardRef = useRef<View>(null)
  const [history, setHistory] = useState(getPlayRecords)
  useEffect(() => subscribePlayHistory(() => { setHistory(getPlayRecords()) }), [])
  const allSources = useMemo(() => {
    const now = Date.now()
    const date = new Date(now)
    const monthly = monthlyReport(history, { year: date.getFullYear(), month: date.getMonth() + 1 }, now)
    const annual = buildRangeStats(history.filter(record => record.startedAt <= now), 'year', now)
    return {
      monthly: { ...monthly, title: t('monthly_month', { year: monthly.year, month: monthly.month }), topSongs: monthly.topSongs.map(item => ({ name: item.song.name, singer: item.song.singer, playCount: item.playCount })) },
      annual: { title: t('share_card_annual_title', { year: date.getFullYear() }), minutes: Math.round(annual.listenedMs / 60_000), playCount: annual.songs.reduce((sum, song) => sum + song.playCount, 0), songCount: annual.songs.length, artistCount: annual.artists.length, topSongs: annual.songs.slice(0, 3).map(item => ({ name: item.song.name, singer: item.song.singer, playCount: item.playCount })) },
      ...sources,
    }
  }, [sources, history, t])
  useEffect(() => {
    let alive = true
    let revision = 0
    const space = getActiveSpace()
    const update = (name: string) => { revision++; if (alive && space === getActiveSpace()) setNickname(name) }
    const request = revision
    void getUserName().then(name => { if (alive && request === revision && space === getActiveSpace()) setNickname(name ?? '') }).catch(() => {})
    const unsubscribe = onDataSpaceWillChange(() => { alive = false; setNickname(''); onClose() })
    global.app_event.on('userNameUpdated', update)
    return () => { alive = false; unsubscribe(); global.app_event.off('userNameUpdated', update) }
  }, [onClose])
  const card = useMemo(() => buildShareCard(allSources, options, nickname), [allSources, options, nickname])
  const lyric = card.content && 'lines' in card.content ? card.content : null
  const report = card.content && 'minutes' in card.content ? card.content : null
  const backgroundColor = options.background === 'paper' ? r.paperRaised : options.background === 'accent' ? r.accent : r.ink
  const ink = options.background === 'ink' ? r.onInk : r.ink
  const muted = options.background === 'paper' ? r.muted : ink
  const share = async(save = false) => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    try {
      const adapter = nativeCardExport(cardRef, t('share_card_share'))
      if (save) {
        if (Platform.OS === 'android' && Number(Platform.Version) < 29 && !await requestStoragePermission()) return
        await captureAndShareCard(card.canExport, { ...adapter, share: saveShareCard })
        toast(t('share_card_saved'))
      } else await captureAndShareCard(card.canExport, adapter, options.tab === 'monthly' ? monthlyFallback : undefined)
    } catch { toast(t('share_card_failed')) } finally { busyRef.current = false; setBusy(false) }
  }
  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.root, { backgroundColor: r.paper, paddingTop: statusBarHeight }]}>
        <ScrollView style={styles.root} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <View style={styles.top}><BackButton onPress={onClose} accessibilityLabel={t('back')} /><TextButton label={t('share_card_done')} onPress={onClose} /></View>
          <Text size={11} color={r.eyebrow} style={styles.eyebrow}>{t('share_card_eyebrow')}</Text>
          <Text size={32} color={r.display} style={styles.title}>{t('share_card_preview')}</Text>
          <TextTabs items={SHARE_CARD_TABS.map(id => ({ id, label: t(`share_card_tab_${id}`) }))} value={options.tab} onChange={id => { setOptions(value => ({ ...value, tab: id as ShareCardTab })) }} style={styles.tabs} tabStyle={{ paddingTop: 8, paddingBottom: 8 }} />
          <View ref={cardRef} collapsable={false} style={[styles.card, { backgroundColor, borderTopColor: ink }]}>
            {lyric ? <>
              <View style={styles.song}>
                {options.showCover ? <Image style={styles.cover} url={lyric.cover} /> : null}
                <View style={styles.songText}><Text size={16} color={ink} style={styles.bold}>{lyric.title}</Text><Text size={11} color={muted}>{[lyric.artist, lyric.album].filter(Boolean).join(' · ')}</Text></View>
              </View>
              <View style={styles.lyrics}>{lyric.lines.map((line, i) => <Text key={i} size={24} color={ink} style={styles.lyric}>{line.text}</Text>)}</View>
              {options.showTranslation ? <Text size={12} color={muted} style={styles.translation}>{lyric.lines.map(line => line.translation).filter(Boolean).join('\n')}</Text> : null}
            </> : report ? <>
              <Text size={16} color={ink} style={styles.bold}>{report.title}</Text>
              <View style={styles.report}><Text size={56} color={ink} style={styles.figure}>{report.minutes.toLocaleString()}</Text><Text size={15} color={ink}>{t('stats_unit_minute')}</Text><Text size={12} color={muted}>{t('share_card_report_summary', { songs: report.songCount, artists: report.artistCount, plays: report.playCount })}</Text>
                {report.topSongs.map((song, i) => <View key={i}><Text size={15} color={ink} style={styles.bold}>{String(i + 1).padStart(2, '0')} · {song.name}</Text><Text size={12} color={muted}>{song.singer} · {t('monthly_plays', { count: song.playCount })}</Text></View>)}
              </View>
            </> : <Text size={15} color={muted} style={styles.empty}>{t('share_card_empty')}</Text>}
            <View style={[styles.watermark, { borderTopColor: options.background === 'paper' ? r.hairline : muted }]}><Text size={10} color={muted} style={styles.brand}>LUX MUSIC</Text><Text size={10} color={muted} style={styles.brand}>{card.watermark}</Text></View>
          </View>
          <View style={styles.backgrounds}>
            <Text size={12} color={r.muted} style={styles.bold}>{t('share_card_background')}</Text>
            <MagSegmented compact style={{ borderRadius: 16 }} items={SHARE_CARD_BACKGROUNDS.map(id => ({ id, label: t(`share_card_background_${id}`) }))} value={options.background} onChange={id => { setOptions(value => ({ ...value, background: id as ShareCardBackground })) }} />
            <Text size={12} color={r.muted}>1080×1440</Text>
          </View>
          <View style={styles.toggles}>
            {(['showTranslation', 'showCover', 'showNickname'] as const).map(key => <SecondaryButton key={key} compact style={styles.toggle} selected={options[key]} label={`${options[key] ? '✓ ' : ''}${t(`share_card_${key}`)}`} onPress={() => { setOptions(value => ({ ...value, [key]: !value[key] })) }} />)}
          </View>
        </ScrollView>
        <View style={styles.footer}>
          <SecondaryButton compact label={t('share_card_save')} onPress={() => { void share(true) }} disabled={!card.canExport || busy} />
          <PrimaryButton compact style={styles.primary} label={t('share_card_share')} onPress={() => { void share() }} disabled={!card.canExport || busy} />
        </View>
      </View>
    </Modal>
  )
}
