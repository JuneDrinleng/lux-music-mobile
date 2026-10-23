/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import { View } from 'react-native'
import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import { weekdayKey } from '@/components/stats/statsShared'
import { useI18n } from '@/lang'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { useSettingValue } from '@/store/setting/hook'
import { setSpText, scaleSizeH } from '@/utils/pixelRatio'
import { FrostedCover } from './FrostedCover'
import { coveredRecommendations, dayNumberMetrics, recommendationMonths } from './coverModel'
import { createStyle } from '@/utils/tools'
import { type Recommendation } from '@/utils/recommend'

const CompactDailyCover = ({ items, compact = false }: { items: Recommendation[], compact?: boolean }) => {
  const t = useI18n()
  const r = magazineRoles(useLuxTheme().colors)
  const styles = useStyles()
  const date = new Date()
  const months = ['recommend_month_1', 'recommend_month_2', 'recommend_month_3', 'recommend_month_4', 'recommend_month_5', 'recommend_month_6', 'recommend_month_7', 'recommend_month_8', 'recommend_month_9', 'recommend_month_10', 'recommend_month_11', 'recommend_month_12'] as const
  const month = t(months[date.getMonth()])
  return (
    <View style={[styles.cover, compact ? styles.compact : styles.large]}>
      <Text size={compact ? 9 : 11} color={r.onInk} style={styles.eyebrow} numberOfLines={1}>
        {t('recommend_cover_today_compact', { month, year: compact ? '' : ` ${date.getFullYear()}` })}
      </Text>
      <Text size={compact ? 48 : 112} color={r.onInk} style={compact ? styles.smallDay : styles.day}>{date.getDate()}</Text>
      <Text size={compact ? 12 : 15} color={r.onInk} style={styles.weekday} numberOfLines={1}>
        {compact ? t(weekdayKey[date.getDay()]) : t('recommend_cover_count', { weekday: t(weekdayKey[date.getDay()]), count: items.length })}
      </Text>
      <View style={[styles.mark, compact ? styles.smallMark : styles.largeMark]} />
      {!compact ? <View style={styles.minis}>{items.slice(0, 3).map(item => <Image key={item.key} url={item.song.img ?? item.musicInfo?.meta.picUrl} style={styles.mini} />)}</View> : null}
    </View>
  )
}
const useStyles = sharedLuxStyles(colors => {
  const r = magazineRoles(colors)
  return createStyle({
    cover: { backgroundColor: r.ink, borderRadius: 6, overflow: 'hidden' },
    large: { width: '100%', height: '100%', padding: 16 },
    compact: { width: 112, height: 112, padding: 10 },
    eyebrow: { fontWeight: '700', letterSpacing: 2, opacity: 0.75 },
    day: { fontWeight: '800', letterSpacing: -6, lineHeight: 100, marginTop: 6 },
    smallDay: { fontWeight: '800', letterSpacing: -3, lineHeight: 48, marginTop: 4 },
    weekday: { fontWeight: '700', marginTop: 6 },
    mark: { position: 'absolute', height: 3, backgroundColor: r.accent },
    largeMark: { left: 16, bottom: 16, width: 28 },
    smallMark: { right: 10, bottom: 12, width: 20 },
    minis: { position: 'absolute', right: 14, bottom: 14, flexDirection: 'row', gap: 4 },
    mini: { width: 44, height: 44, borderRadius: 4, backgroundColor: r.placeholder },
  })
})

// Keep the detail page's compact cover independent of the home card redesign.
export const DailyCover = ({ items, compact = false }: { items: Recommendation[], compact?: boolean }) => {
  const t = useI18n()
  const language = useSettingValue('common.langId')
  const r = magazineRoles(useLuxTheme().colors)
  const styles = useHomeStyles()
  const date = new Date()
  const covered = coveredRecommendations(items)
  const metrics = dayNumberMetrics(setSpText, scaleSizeH)
  if (compact) return <CompactDailyCover items={items} compact />
  const month = language === 'en_us' ? t(recommendationMonths[date.getMonth()]) : date.getMonth() + 1
  return (
    <View style={styles.cover}>
      <FrostedCover uri={covered[0]?.cover} />
      <Text size={11} color={r.ink} style={styles.eyebrow} numberOfLines={1}>{t('recommend_cover_today', { month, year: date.getFullYear() })}</Text>
      <Text size={100} color={r.ink} style={[styles.day, { lineHeight: metrics.lineHeight, marginTop: metrics.gap }]}>{date.getDate()}</Text>
      <Text size={15} color={r.ink} style={styles.weekday} numberOfLines={1}>{t('recommend_cover_count', { weekday: t(weekdayKey[date.getDay()]), count: items.length })}</Text>
      <View style={styles.mark} />
      <View style={styles.minis}>{covered.slice(0, 3).map(({ item, cover }) => <Image key={item.key} url={cover} style={styles.mini} />)}</View>
    </View>
  )
}
const useHomeStyles = sharedLuxStyles(colors => {
  const r = magazineRoles(colors)
  return createStyle({
    cover: { width: '100%', height: '100%', padding: 16, overflow: 'hidden', backgroundColor: r.placeholder },
    eyebrow: { fontWeight: '700', letterSpacing: 2, lineHeight: 14, opacity: 0.66 },
    day: { fontWeight: '800', letterSpacing: -5, fontVariant: ['tabular-nums'], includeFontPadding: false },
    weekday: { fontWeight: '700', lineHeight: 20, marginTop: 4 },
    mark: { position: 'absolute', left: 16, bottom: 16, width: 28, height: 3, backgroundColor: r.accent },
    minis: { position: 'absolute', right: 14, bottom: 14, flexDirection: 'row', gap: 4 },
    mini: { width: 44, height: 44, borderRadius: 4, backgroundColor: r.placeholder },
  })
})
