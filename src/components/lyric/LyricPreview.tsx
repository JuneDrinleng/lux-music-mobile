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
  // Reserve extras by availability, not by the current sentence's contents.
  const extraCount = Number(translation && available.translation) + Number(roma && available.roma)
  const extraHeight = styles.extra.height * extraCount
  const height = styles.neighbor.height * 2 + styles.currentSlot.height + extraHeight
  // Extras sit below the current line: entry travels farther than exit.
  const step = (styles.neighbor.height + styles.currentSlot.height) / 2
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
        <View style={styles.neighbor}>
          <Text size={14} color={r.faint} numberOfLines={1}>{previousLine?.text ?? ''}</Text>
        </View>
        <View style={styles.currentSlot}>
          {current ? (foreground
            ? <KaraokeLine line={current} size={19} style={styles.current} active={active} singleLine />
            : <Text size={19} color={r.display} style={styles.current} numberOfLines={1}>{current.text}</Text>
          ) : null}
        </View>
        {translation && available.translation ? <View style={styles.extra}><Text size={13} color={r.muted} numberOfLines={1}>{current?.translation ?? ''}</Text></View> : null}
        {roma && available.roma ? <View style={styles.extra}><Text size={13} color={r.muted} numberOfLines={1}>{current?.roma ?? ''}</Text></View> : null}
        <View style={styles.neighbor}>
          <Text size={14} color={r.faint} numberOfLines={1}>{next?.text ?? ''}</Text>
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
  lines: { minWidth: 0, overflow: 'hidden' },
  layer: { position: 'absolute', top: 0, left: 0, right: 0 },
  neighbor: { height: 22, justifyContent: 'center' },
  currentSlot: { height: 28, justifyContent: 'center' },
  extra: { height: 18, justifyContent: 'center' },
  current: { fontWeight: '800' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, minHeight: 44 },
  pill: { minWidth: 44, paddingHorizontal: 14 },
  hint: { flexShrink: 1 },
}))
