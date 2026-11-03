/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import { memo, useMemo } from 'react'
import { View } from 'react-native'
import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import { useI18n } from '@/lang'
import { useSettingValue } from '@/store/setting/hook'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { createStyle } from '@/utils/tools'
import { setSpText } from '@/utils/pixelRatio'
import { useCoverDate } from './useCoverDate'
import { FrostedCover } from './FrostedCover'
import { currentRecommendationWeek, recommendationMonths, weeklyCover } from './coverModel'

export const WeeklyCover = memo(({ cover, count, active = true }: { cover: string | null, count?: number | null, active?: boolean }) => {
  const t = useI18n()
  const language = useSettingValue('common.langId')
  const r = magazineRoles(useLuxTheme().colors)
  const styles = useStyles()
  const day = useCoverDate(active)
  const { week, heading } = useMemo(() => {
    const { monday, sunday, week } = currentRecommendationWeek(new Date(day))
    const english = language === 'en_us'
    const rangeDate = (date: Date) => english
      ? `${t(recommendationMonths[date.getMonth()])} ${date.getDate()}`
      : `${date.getMonth() + 1}.${date.getDate()}`
    const start = rangeDate(monday)
    const end = english && monday.getMonth() === sunday.getMonth() ? String(sunday.getDate()) : rangeDate(sunday)
    return { week, heading: t('recommend_cover_weekly', { start, end }) }
  }, [day, language, t])
  const uri = weeklyCover({ cover })
  const lineHeight = Math.max(setSpText(48), setSpText(44))
  const weekStyle = useMemo(() => [styles.week, { lineHeight }], [styles.week, lineHeight])
  const countLabel = useMemo(() => count == null
    ? t('recommend_cover_week', { week })
    : t('recommend_cover_week_count', { week, count }), [count, week, t])
  return (
    <View style={styles.cover}>
      <FrostedCover uri={uri} />
      <Text size={11} color={r.ink} style={styles.eyebrow} numberOfLines={1}>{heading}</Text>
      <View style={styles.thumbnail}><Image url={uri} style={styles.image} /></View>
      <View style={styles.meta}>
        <Text size={44} color={r.ink} style={weekStyle}>{week}</Text>
        <Text size={13} color={r.ink} style={styles.count} numberOfLines={1}>{countLabel}</Text>
      </View>
    </View>
  )
})
const useStyles = sharedLuxStyles(colors => {
  const r = magazineRoles(colors)
  return createStyle({
    cover: { width: '100%', height: '100%', padding: 16, overflow: 'hidden', backgroundColor: r.placeholder },
    eyebrow: { fontWeight: '700', letterSpacing: 2, lineHeight: 14, opacity: 0.66 },
    thumbnail: { position: 'absolute', left: 16, bottom: 16, width: 132, height: 132, borderRadius: 4, backgroundColor: r.placeholder, shadowColor: r.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 3 },
    image: { width: '100%', height: '100%', borderRadius: 4 },
    meta: { position: 'absolute', left: 162, bottom: 16 },
    week: { fontWeight: '800', letterSpacing: -2, fontVariant: ['tabular-nums'], includeFontPadding: false },
    count: { fontWeight: '700', lineHeight: 18 },
  })
})
