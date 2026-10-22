/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import { ScrollView, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import { useI18n } from '@/lang'
import { useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { dailyStripItems, recommendationReasonKey } from '@/utils/recommend/viewModel'
import { useRecommendations } from './useRecommendations'
import { playRecommendations, startRecommendationRadio } from './actions'
import { RecommendationButton, RecommendationStatus, useRecommendationAction, useRecommendationStyles } from './RecommendationViews'

export const DailyStrip = () => {
  const { batch, loading, failed, reload } = useRecommendations()
  const t = useI18n()
  const r = magazineRoles(useLuxTheme().colors)
  const styles = useRecommendationStyles()
  const { run, pending } = useRecommendationAction()
  const items = dailyStripItems(batch?.items ?? [])
  const radio = async() => {
    if (!items[0]) return
    const next = await startRecommendationRadio(items[0].song)
    if (!next.items.length) throw new Error('No radio candidates')
  }
  return (
    <View>
      <View style={styles.rule} />
      <View style={styles.heading}>
        <Text size={22} color={r.display} style={{ fontWeight: '800' }}>{t('recommend_daily')}</Text>
        <Text size={12} color={r.muted} style={{ fontWeight: '600', flexShrink: 1 }}>{t('recommend_daily_meta', { count: items.length })}</Text>
      </View>
      <RecommendationStatus loading={loading} failed={failed} failures={batch?.failures.length ?? 0} empty={!items.length} reload={() => { void reload(true) }} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strip} contentContainerStyle={styles.stripContent}>
        {items.map(item => (
          <TouchableOpacity key={item.key} style={styles.card} disabled={pending || loading} accessibilityRole="button"
            accessibilityLabel={`${item.song.name}, ${t(recommendationReasonKey(item))}`}
            onPress={() => { void run(async() => playRecommendations([item])) }} activeOpacity={0.7}>
            <Image url={item.song.img ?? item.musicInfo?.meta.picUrl} style={styles.cover} />
            <Text size={15} color={r.list} style={styles.cardTitle} numberOfLines={1}>{item.song.name}</Text>
            <Text size={12} color={r.muted} style={styles.reason} numberOfLines={1}>{t(recommendationReasonKey(item))}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={styles.actions}>
        <RecommendationButton label={t('recommend_play_daily')} fill disabled={!items.length || loading || pending} onPress={() => { void run(async() => playRecommendations(items)) }} />
        <RecommendationButton label={t('recommend_start_radio')} disabled={!items.length || loading || pending} onPress={() => { void run(radio, t('recommend_radio_started')) }} />
      </View>
    </View>
  )
}
