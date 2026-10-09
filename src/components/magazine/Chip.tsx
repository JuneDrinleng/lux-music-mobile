/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo } from 'react'
import { TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { createStyle } from '@/utils/tools'

const useStyles = sharedLuxStyles((colors) => {
  const r = magazineRoles(colors)
  return createStyle({
    chip: {
      height: 30,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: r.hairline,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    chipOn: {
      backgroundColor: r.ink,
      borderColor: r.ink,
    },
    status: {
      height: 26,
      paddingHorizontal: 10,
      borderRadius: 999,
      backgroundColor: r.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statusSm: {
      height: 24,
      paddingHorizontal: 10,
    },
    label: {
      fontWeight: '600',
    },
    labelOn: {
      fontWeight: '700',
    },
    statusLabel: {
      fontWeight: '800',
    },
  })
})

export const Chip = memo(({
  label,
  selected = false,
  onPress,
}: {
  label: string
  selected?: boolean
  onPress?: () => void
}) => {
  const styles = useStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const body = (
    <View style={[styles.chip, selected ? styles.chipOn : null]}>
      <Text
        size={13}
        color={selected ? r.onInk : r.ink}
        style={selected ? styles.labelOn : styles.label}
      >{label}</Text>
    </View>
  )
  if (!onPress) return body
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }}>
      {body}
    </TouchableOpacity>
  )
})

export const StatusChip = memo(({
  label,
  small = false,
}: {
  label: string
  small?: boolean
}) => {
  const styles = useStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  return (
    <View style={[styles.status, small ? styles.statusSm : null]}>
      <Text size={small ? 12 : 13} color={r.onAccent} style={styles.statusLabel}>{label}</Text>
    </View>
  )
})
