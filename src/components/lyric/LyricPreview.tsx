/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Animated, Easing, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import { SecondaryButton } from '@/components/magazine'
import { useI18n } from '@/lang'
import { type Line } from '@/plugins/lyric'
import { toggleLyricExtra } from '@/plugins/lyricWords'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { createStyle } from '@/utils/tools'
import KaraokeLine from './KaraokeLine'

// June 2026-11-12: design units at the 375 baseline; extras donate unused height.
const LYRIC_TIERS = [
  { neighborHeight: 32, currentHeight: 44, neighborSize: 17, currentSize: 24 },
  { neighborHeight: 27, currentHeight: 36, neighborSize: 16, currentSize: 22 },
  { neighborHeight: 22, currentHeight: 28, neighborSize: 14, currentSize: 19 },
]
const LYRIC_RESIZE_MS = 200
const LYRIC_LINES_HEIGHT = 108

export default memo(({ lines, index, active, onPress }: {
  lines: Line[]
  index: number
  active: boolean
  onPress: () => void
}) => {
  const styles = useStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const t = useI18n()
  const [translation, setTranslation] = useState(true)
  const [roma, setRoma] = useState(false)
  const available = useMemo(() => ({ translation: lines.some(line => Boolean(line.translation)), roma: lines.some(line => Boolean(line.roma)) }), [lines])
  const progress = useRef(new Animated.Value(1)).current
  const previous = useRef({ lines, index, active })
  const [outgoing, setOutgoing] = useState<{ lines: Line[], index: number } | null>(null)
  const showTranslation = Boolean(translation && lines[index]?.translation)
  const showRoma = Boolean(roma && lines[index]?.roma)
  const extraCount = Number(showTranslation) + Number(showRoma)
  const [extraWeights, setExtraWeights] = useState({ translation: Number(showTranslation), roma: Number(showRoma) })
  const weightsRef = useRef(extraWeights)
  const resize = useRef(new Animated.Value(1)).current
  useLayoutEffect(() => {
    const from = weightsRef.current
    const to = { translation: Number(showTranslation), roma: Number(showRoma) }
    if (from.translation === to.translation && from.roma === to.roma) return
    resize.setValue(0)
    const listener = resize.addListener(({ value }) => {
      const weights = {
        translation: from.translation + (to.translation - from.translation) * value,
        roma: from.roma + (to.roma - from.roma) * value,
      }
      weightsRef.current = weights
      setExtraWeights(weights)
    })
    const animation = Animated.timing(resize, {
      toValue: 1,
      duration: LYRIC_RESIZE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    })
    animation.start()
    return () => { animation.stop(); resize.removeListener(listener) }
  }, [resize, showTranslation, showRoma])
  const count = extraWeights.translation + extraWeights.roma
  const low = Math.min(1, Math.floor(count))
  const mix = count - low
  const tier = LYRIC_TIERS[low]
  const nextTier = LYRIC_TIERS[low + 1]
  const interpolate = (key: keyof typeof tier) => tier[key] + (nextTier[key] - tier[key]) * mix
  const rowStyles = createStyle({
    neighbor: { height: interpolate('neighborHeight'), justifyContent: 'center' },
    currentSlot: { height: interpolate('currentHeight'), justifyContent: 'center' },
  })
  const neighborSize = interpolate('neighborSize')
  const currentSize = interpolate('currentSize')
  // Use one scaled 108-unit viewport; derive the current row to avoid rounding drift.
  const height = styles.lines.height
  const extraHeight = styles.extra.height * count
  const currentHeight = height - rowStyles.neighbor.height * 2 - extraHeight
  // Extras sit below the current line: entry travels farther than exit.
  const step = (rowStyles.neighbor.height + currentHeight) / 2
  const transitioning = active && outgoing?.lines === lines && outgoing.index === index - 1

  useLayoutEffect(() => {
    const before = previous.current
    previous.current = { lines, index, active }
    progress.stopAnimation()
    // Only a forward single-line advance in the same foreground session scrolls.
    const shouldAnimate = active && before.active && before.lines === lines &&
      index === before.index + 1 && Boolean(lines[before.index]) && Boolean(lines[index])
    if (!shouldAnimate) {
      setOutgoing(null)
      progress.setValue(1)
      return
    }
    setOutgoing({ lines: before.lines, index: before.index })
    progress.setValue(0)
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    })
    animation.start(({ finished }) => { if (finished) setOutgoing(null) })
    return () => { animation.stop() }
  }, [active, index, lines, progress, extraCount])

  const renderLines = (at: number, foreground: boolean) => {
    const previousLine = lines[at - 1]
    const current = lines[at]
    const next = lines[at + 1]
    return (
      <>
        <View style={rowStyles.neighbor}>
          <Text size={neighborSize} color={r.faint} numberOfLines={1}>{previousLine?.text ?? ''}</Text>
        </View>
        <View style={[rowStyles.currentSlot, { height: currentHeight }]}>
          {current ? (foreground
            ? <KaraokeLine line={current} size={currentSize} style={styles.current} active={active} singleLine />
            : <Text size={currentSize} color={r.display} style={styles.current} numberOfLines={1}>{current.text}</Text>
          ) : null}
        </View>
        <View style={[styles.extra, { height: styles.extra.height * extraWeights.translation, opacity: extraWeights.translation, overflow: 'hidden' }]}>
          {showTranslation ? <Text size={13} color={r.muted} numberOfLines={1}>{current?.translation ?? ''}</Text> : null}
        </View>
        <View style={[styles.extra, { height: styles.extra.height * extraWeights.roma, opacity: extraWeights.roma, overflow: 'hidden' }]}>
          {showRoma ? <Text size={13} color={r.muted} numberOfLines={1}>{current?.roma ?? ''}</Text> : null}
        </View>
        <View style={rowStyles.neighbor}>
          <Text size={neighborSize} color={r.faint} numberOfLines={1}>{next?.text ?? ''}</Text>
        </View>
      </>
    )
  }
  return (
    <View>
      <TouchableOpacity style={styles.preview} onPress={onPress} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={t('player_lyric_enter_hint')}>
        <View style={[styles.accent, { backgroundColor: r.accent }]} />
        <View style={[styles.lines, { height }]}>
          {transitioning ? (
            <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.layer, {
              opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
              transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -step] }) }],
            }]}>
              {renderLines(outgoing.index, false)}
            </Animated.View>
          ) : null}
          <Animated.View style={[styles.layer, {
            opacity: transitioning ? progress : 1,
            transform: [{ translateY: transitioning ? progress.interpolate({ inputRange: [0, 1], outputRange: [step + extraHeight, 0] }) : 0 }],
          }]}>
            {renderLines(index, true)}
          </Animated.View>
        </View>
      </TouchableOpacity>
      <View style={styles.actions}>
        <SecondaryButton compact labelSize={12} style={styles.pill} label={t('player_lyric_translation_pill')} selected={translation && available.translation} disabled={!available.translation} onPress={() => { setTranslation(value => toggleLyricExtra(value, available.translation)) }} />
        <SecondaryButton compact labelSize={12} style={styles.pill} label={t('player_lyric_roma_pill')} selected={roma && available.roma} disabled={!available.roma} onPress={() => { setRoma(value => toggleLyricExtra(value, available.roma)) }} />
        <Text size={12} color={r.muted} style={styles.hint} onPress={onPress}>{t('player_lyric_enter_hint')}</Text>
      </View>
    </View>
  )
})

const useStyles = sharedLuxStyles(() => createStyle({
  preview: { minHeight: 48, position: 'relative' },
  accent: { position: 'absolute', left: -22, top: 0, bottom: 0, width: 3 },
  lines: { height: LYRIC_LINES_HEIGHT, minWidth: 0, overflow: 'hidden' },
  layer: { position: 'absolute', top: 0, left: 0, right: 0 },
  extra: { height: 18, justifyContent: 'center' },
  current: { fontWeight: '800' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, minHeight: 44 },
  pill: { minWidth: 44, paddingHorizontal: 14 },
  hint: { flexShrink: 1 },
}))
