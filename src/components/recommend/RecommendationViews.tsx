/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import { useRef, useState, type ReactNode } from 'react'
import { TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import { Hairline, SourceTag } from '@/components/magazine'
import { useI18n } from '@/lang'
import { magazineRoles } from '@/theme/magazineRoles'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { createStyle } from '@/utils/tools'
import { showMagToast } from '@/components/magazine/toastBus'
import { recommendationReasonKey } from '@/utils/recommend/viewModel'
import { type Recommendation, type Song } from '@/utils/recommend'

export const useRecommendationAction = () => {
  const t = useI18n()
  const busy = useRef(false)
  const [pending, setPending] = useState(false)
  const run = async(action: () => Promise<unknown>, success?: string) => {
    if (busy.current) return
    busy.current = true
    setPending(true)
    try {
      await action()
      if (success) showMagToast({ message: success })
    } catch { showMagToast({ message: t('recommend_action_failed'), tone: 'danger' }) } finally {
      busy.current = false
      setPending(false)
    }
  }
  return { run, pending }
}

export const RecommendationButton = ({ label, onPress, fill = false, disabled = false, grow = false }: {
  label: string
  onPress: () => void
  fill?: boolean
  disabled?: boolean
  grow?: boolean
}) => {
  const styles = useRecommendationStyles()
  const r = magazineRoles(useLuxTheme().colors)
  return (
    <View style={[styles.buttonTarget, grow ? { flex: 1 } : null]}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}
        disabled={disabled} onPress={onPress} activeOpacity={0.7} hitSlop={8}
        style={[styles.button, { borderColor: r.ink, backgroundColor: fill ? r.ink : r.paper, opacity: disabled ? 0.45 : 1 }]}>
        <Text size={13} color={fill ? r.onInk : r.ink} style={styles.bold} numberOfLines={1}>{label}</Text>
      </TouchableOpacity>
    </View>
  )
}

export const RecommendationStatus = ({ loading, failed, failures, empty, reload, compact = false }: {
  loading: boolean
  failed: boolean
  failures: number
  empty: boolean
  reload: () => void
  compact?: boolean
}) => {
  const t = useI18n()
  const styles = useRecommendationStyles()
  const r = magazineRoles(useLuxTheme().colors)
  if (!loading && !failed && !failures && !empty) return null
  return (
    <View style={[styles.status, compact ? styles.compactStatus : null]} accessibilityLiveRegion="polite">
      <Text size={12} color={r.muted}>{t(loading ? 'loading' : failed ? 'recommend_failed' : failures ? 'recommend_sources_failed' : 'recommend_empty', { count: failures })}</Text>
      {!loading && (failed || failures > 0 || empty) ? <RecommendationButton label={t('recommend_retry')} onPress={reload} /> : null}
    </View>
  )
}

export const RecommendationSong = ({ song, item, subject = false, trailing, onPress, disabled = false }: {
  song: Song
  item?: Recommendation
  subject?: boolean
  trailing?: ReactNode
  onPress?: () => void
  disabled?: boolean
}) => {
  const styles = useRecommendationStyles()
  const t = useI18n()
  const r = magazineRoles(useLuxTheme().colors)
  const body = (
    <View style={[styles.song, subject ? styles.subject : null]}>
      <Image url={song.img} style={subject ? styles.seedCover : styles.rowCover} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text size={subject ? 17 : 15} color={r.list} style={[styles.bold, subject ? { fontWeight: '800' } : null]} numberOfLines={1}>{song.name}</Text>
        <View style={styles.songMeta}>
          <SourceTag source={song.source} label={song.source} />
          <Text size={12} color={r.muted} numberOfLines={1} style={{ flexShrink: 1 }}>
            {song.singer}{item ? ` · ${t(recommendationReasonKey(item))}` : ''}
          </Text>
        </View>
      </View>
      {trailing}
    </View>
  )
  return <View>{onPress ? <TouchableOpacity disabled={disabled} onPress={onPress} activeOpacity={0.7} accessibilityRole="button">{body}</TouchableOpacity> : body}{!subject ? <Hairline /> : null}</View>
}

export const useRecommendationStyles = sharedLuxStyles(colors => {
  const r = magazineRoles(colors)
  return createStyle({
    bold: { fontWeight: '700' },
    rule: { height: 2, backgroundColor: r.ink, marginTop: 22, marginBottom: 12 },
    heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
    strip: { marginTop: 12, marginRight: -22 },
    stripContent: { gap: 12, paddingRight: 22 },
    card: { width: 120 },
    cover: { width: 120, height: 120, borderRadius: 4, backgroundColor: r.placeholder },
    cardTitle: { fontWeight: '700', marginTop: 6 },
    reason: { marginTop: 2 },
    actions: { flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' },
    buttonTarget: { minHeight: 44, justifyContent: 'center' },
    button: { height: 28, borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
    status: { paddingVertical: 12, gap: 16, alignItems: 'flex-start' },
    compactStatus: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, paddingVertical: 8 },
    song: { flexDirection: 'row', gap: 12, alignItems: 'center', minHeight: 56, paddingVertical: 8 },
    subject: { minHeight: 48, paddingVertical: 0, marginBottom: 6 },
    songMeta: { flexDirection: 'row', gap: 4, marginTop: 2, alignItems: 'center' },
    rowCover: { width: 40, height: 40, borderRadius: 4, backgroundColor: r.placeholder },
    seedCover: { width: 48, height: 48, borderRadius: 4, backgroundColor: r.placeholder },
    footer: { marginHorizontal: -22, paddingHorizontal: 22, paddingTop: 12, paddingBottom: 26, borderTopWidth: 2, borderTopColor: r.ink, flexDirection: 'row', gap: 16 },
    add: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  })
})
