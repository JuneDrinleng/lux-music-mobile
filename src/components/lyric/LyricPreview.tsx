/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo, useMemo, useState } from 'react'
import { TouchableOpacity, View } from 'react-native'
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
  const current = lines[index]
  const next = lines[index + 1]
  return (
    <View>
      <TouchableOpacity style={styles.preview} onPress={onPress} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={t('player_lyric_enter_hint')}>
        <View style={[styles.accent, { backgroundColor: r.accent }]} />
        <View style={styles.lines}>
          {current ? <KaraokeLine line={current} size={19} style={styles.current} active={active} singleLine /> : null}
          {translation && current?.translation ? <Text size={13} color={r.muted} numberOfLines={1}>{current.translation}</Text> : null}
          {roma && current?.roma ? <Text size={13} color={r.muted} numberOfLines={1}>{current.roma}</Text> : null}
          {next ? <Text size={14} color={r.faint} numberOfLines={1} style={styles.next}>{next.text}</Text> : null}
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
  lines: { minWidth: 0 },
  current: { fontWeight: '800' },
  next: { marginTop: 4 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, minHeight: 44 },
  pill: { minWidth: 44, paddingHorizontal: 14 },
  hint: { flexShrink: 1 },
}))
