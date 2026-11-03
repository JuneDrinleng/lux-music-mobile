/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { useSettingsTransition } from '@/components/common/SettingsPage'
import { useCallback } from 'react'
import { Animated, ScrollView, StyleSheet, View } from 'react-native'
import Text from '@/components/common/Text'
import { DOCK_BASE_HEIGHT, MagTopBar, Rule, SongRow } from '@/components/magazine'
import { weekdayKey } from '@/components/stats/statsShared'
import { APP_LAYER_INDEX } from '@/config/constant'
import { useI18n } from '@/lang'
import commonState from '@/store/common/state'
import { useStatusbarHeight } from '@/store/common/hook'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { PAGE_GUTTER, magType } from '@/theme/magazineType'
import { createStyle } from '@/utils/tools'
import { useBackHandler } from '@/utils/hooks/useBackHandler'
import { isHomeScreenActive } from '@/utils/homeBackHandler'
import useSystemGestureInsetBottom from '@/utils/hooks/useSystemGestureInsetBottom'
import { recommendationReasonKey } from '@/utils/recommend/viewModel'
import { DailyCover } from './DailyCover'
import { useRecommendations } from './useRecommendations'
import { playRecommendations, startRecommendationRadio } from './actions'
import { RecommendationButton, RecommendationStatus, useRecommendationAction } from './RecommendationViews'

export const DailyRecommendationPage = ({ onClose: finishClose }: { onClose: () => void }) => {
  const { style: pageStyle, requestClose } = useSettingsTransition()
  const onClose = useCallback(() => { requestClose(finishClose) }, [requestClose, finishClose])
  const { batch, loading, failed, reload } = useRecommendations()
  const items = batch?.items ?? []
  const t = useI18n()
  const r = magazineRoles(useLuxTheme().colors)
  const styles = useStyles()
  const statusbarHeight = useStatusbarHeight()
  const gestureInset = useSystemGestureInsetBottom()
  const { pending, run } = useRecommendationAction()
  const disabled = !items.length || loading || pending
  useBackHandler(useCallback(() => {
    if (!isHomeScreenActive(commonState.componentIds)) return false
    onClose()
    return true
  }, [onClose]))
  const date = new Date()
  const dateLabel = `${t('stats_date_md', { month: date.getMonth() + 1, day: date.getDate() })} ${t(weekdayKey[date.getDay()])}`
  const intervals = items.map(item => item.song.interval ?? item.musicInfo?.interval)
  const totalSeconds = intervals.reduce((total, interval) => {
    if (!interval || !/^\d+:\d{2}(?::\d{2})?$/.test(interval)) return total
    return total + interval.split(':').reduce((seconds, part) => seconds * 60 + Number(part), 0)
  }, 0)
  const totalMinutes = Math.round(totalSeconds / 60)
  const duration = totalSeconds > 0 ? t('recommend_duration', { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 }) : ''
  const radio = async() => {
    if (!items[0]) return
    const next = await startRecommendationRadio(items[0].song)
    if (!next.items.length) throw new Error('No radio candidates')
  }
  return (
    <Animated.View style={[styles.root, pageStyle]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: statusbarHeight, paddingBottom: DOCK_BASE_HEIGHT + gestureInset + 24 }]} showsVerticalScrollIndicator={false}>
        <MagTopBar onBack={onClose} />
        <Text size={11} color={r.eyebrow} style={styles.eyebrow}>{t('recommend_detail_eyebrow', { date: dateLabel })}</Text>
        <Text size={magType.h2.size} color={r.display} style={styles.title}>{t('recommend_daily')}</Text>
        <View style={styles.summary}>
          <DailyCover items={items} compact />
          <View style={styles.meta}>
            <Text size={15} color={r.ink} style={styles.bold}>{t('home_daily_tracks', { count: items.length })}{duration ? ` · ${duration}` : ''}</Text>
            <Text size={12} color={r.muted} style={styles.description}>{t('recommend_detail_description')}</Text>
          </View>
        </View>
        <View style={styles.actions}>
          <RecommendationButton label={t('recommend_play_all')} fill disabled={disabled} onPress={() => { void run(async() => playRecommendations(items)) }} />
          <RecommendationButton label={t('recommend_start_radio')} disabled={disabled} onPress={() => { void run(radio, t('recommend_radio_started')) }} />
        </View>
        <Rule gapTop={10} />
        <RecommendationStatus loading={loading} failed={failed} failures={batch?.failures.length ?? 0} empty={!items.length} reload={() => { void reload(true) }} />
        {items.map((item, index) => (
          <SongRow key={item.key} index={index + 1} title={item.song.name} coverUri={item.song.img ?? item.musicInfo?.meta.picUrl}
            source={item.song.source} sourceLabel={item.song.source} subtitle={t(recommendationReasonKey(item))}
            duration={item.song.interval ?? item.musicInfo?.interval ?? undefined} last={index === items.length - 1}
            onPress={() => { if (!loading && !pending) void run(async() => playRecommendations([item])) }} />
        ))}
      </ScrollView>
    </Animated.View>
  )
}
const useStyles = sharedLuxStyles(colors => {
  const r = magazineRoles(colors)
  return createStyle({
    root: { ...StyleSheet.absoluteFillObject, zIndex: APP_LAYER_INDEX.controls - 1, backgroundColor: r.paper },
    content: { paddingHorizontal: PAGE_GUTTER },
    eyebrow: { fontWeight: '700', letterSpacing: 2, marginTop: 18 },
    title: { fontWeight: '800', lineHeight: 38, letterSpacing: -0.8, marginTop: 8 },
    summary: { flexDirection: 'row', gap: 14, marginTop: 16 },
    meta: { flex: 1, minWidth: 0, justifyContent: 'center' },
    bold: { fontWeight: '700' },
    description: { marginTop: 4, lineHeight: 18 },
    actions: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  })
})
