/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import { useState, type ReactNode } from 'react'
import { ScrollView, TouchableOpacity, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'
import Text from '@/components/common/Text'
import { SectionHeader } from '@/components/magazine'
import { useI18n } from '@/lang'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { createStyle } from '@/utils/tools'
import { DailyCover } from './DailyCover'
import { WeeklyCover } from './WeeklyCover'
import { useRecommendations } from './useRecommendations'
import { playRecommendations, startRecommendationRadio } from './actions'
import { RecommendationButton, RecommendationStatus, useRecommendationAction } from './RecommendationViews'

const CARD_RATIO = 300 / 349

export const RecCard = ({ width, gap, kicker, title, label, cover, onPress }: {
  width: number
  gap: number
  kicker: string
  title: string
  label: string
  cover: ReactNode
  onPress: () => void
}) => {
  const r = magazineRoles(useLuxTheme().colors)
  const styles = useStyles()
  return (
    <TouchableOpacity style={{ width, height: width * 0.75 + 58, marginRight: gap }} onPress={onPress} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={label}>
      <View style={[styles.cover, { height: width * 0.75 }]}>{cover}</View>
      <Text size={11} color={r.eyebrow} style={styles.kicker} numberOfLines={1}>{kicker}</Text>
      <Text size={22} color={r.display} style={styles.title} numberOfLines={1}>{title}</Text>
    </TouchableOpacity>
  )
}

export const RecommendationSection = ({ discover, onOpenWeekly, onPlayWeekly }: {
  discover: { cover: string | null, title: string, sourceListId: string | null, count?: number | null }
  onOpenWeekly: () => void
  onPlayWeekly: () => void
}) => {
  const { batch, loading, failed, reload } = useRecommendations()
  const items = batch?.items ?? []
  const [contentWidth, setContentWidth] = useState(0)
  const [currentIndex, setCurrentIndex] = useState(0)
  const t = useI18n()
  const r = magazineRoles(useLuxTheme().colors)
  const styles = useStyles()
  const { run, pending } = useRecommendationAction()
  const cardWidth = contentWidth * CARD_RATIO
  const gap = contentWidth * 14 / 349
  const interval = cardWidth + gap
  // Native end clamping right-aligns the last card without trailing blank space.
  const onMomentumScrollEnd = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (interval > 0) setCurrentIndex(Math.max(0, Math.min(1, Math.round(nativeEvent.contentOffset.x / interval))))
  }
  const radio = async() => {
    if (!items[0]) return
    const next = await startRecommendationRadio(items[0].song)
    if (!next.items.length) throw new Error('No radio candidates')
  }
  const dailyDisabled = !items.length || loading || pending
  return (
    <View onLayout={({ nativeEvent }) => { setContentWidth(nativeEvent.layout.width) }}>
      <SectionHeader title={t('recommend_for_you')} meta={t('recommend_swipe_hint')} ruleGap={0} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.carousel}
        snapToInterval={interval || 1} decelerationRate="fast" snapToAlignment="start" bounces={false}
        onMomentumScrollEnd={onMomentumScrollEnd}>
        <RecCard width={cardWidth} gap={gap} kicker={t('recommend_daily_kicker')} title={t('recommend_daily')} label={t('recommend_open_daily')}
          cover={<DailyCover items={items} />} onPress={() => { global.app_event.openDailyRecommendations() }} />
        <RecCard width={cardWidth} gap={0} kicker={t('home_discover_kicker')} title={discover.title} label={t('recommend_open_weekly', { title: discover.title })}
          cover={<WeeklyCover discover={discover} />} onPress={onOpenWeekly} />
      </ScrollView>
      <View style={styles.actions}>
        <RecommendationButton label={t('recommend_play_radio')} disabled={dailyDisabled} onPress={() => { void run(radio, t('recommend_radio_started')) }} />
        <RecommendationButton label={t('recommend_play_current')} fill disabled={currentIndex === 0 ? dailyDisabled : !discover.sourceListId}
          onPress={() => { if (currentIndex === 0) void run(async() => playRecommendations(items)); else onPlayWeekly() }} />
        <View style={styles.dots} accessibilityLabel={t('recommend_page', { page: currentIndex + 1, count: 2 })}>
          {[0, 1].map(index => <View key={index} style={[styles.dot, { width: index === currentIndex ? 16 : 6, backgroundColor: index === currentIndex ? r.ink : r.quiet }]} />)}
        </View>
      </View>
      <RecommendationStatus compact loading={loading} failed={failed} failures={batch?.failures.length ?? 0} empty={!items.length} reload={() => { void reload(true) }} />
    </View>
  )
}
const useStyles = sharedLuxStyles(colors => {
  const r = magazineRoles(colors)
  return createStyle({
    carousel: { marginTop: 12, overflow: 'visible' },
    cover: { borderRadius: 6, overflow: 'hidden', backgroundColor: r.placeholder },
    kicker: { fontWeight: '700', letterSpacing: 2, marginTop: 12, lineHeight: 14 },
    title: { fontWeight: '800', letterSpacing: -0.3, marginTop: 4, lineHeight: 28 },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
    dots: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 5 },
    dot: { height: 6, borderRadius: 3 },
  })
})
