/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo } from 'react'
import { TouchableOpacity, View, type ViewStyle, type TextStyle } from 'react-native'

import Text from '@/components/common/Text'
import { MdiIcon } from '@/components/common/MdiIcon'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { magType } from '@/theme/magazineType'
import { createStyle } from '@/utils/tools'

const useStyles = sharedLuxStyles((colors) => {
  const r = magazineRoles(colors)
  return createStyle({
    btn: {
      height: 44,
      borderRadius: 999,
      backgroundColor: r.ink,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 6,
      paddingHorizontal: 18,
    },
    danger: {
      backgroundColor: r.danger,
    },
    disabled: {
      opacity: 0.4,
    },
    label: {
      fontWeight: '700',
    },
  })
})

export const PrimaryButton = memo(({
  label,
  onPress,
  disabled = false,
  danger = false,
  icon,
  style,
  compact = false,
  labelSize,
  labelStyle,
  badge,
}: {
  label: string
  onPress?: () => void
  disabled?: boolean
  danger?: boolean
  icon?: string
  style?: ViewStyle
  compact?: boolean
  labelSize?: number
  labelStyle?: TextStyle
  badge?: number
}) => {
  const styles = useStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  return (
    <TouchableOpacity
      style={[styles.btn, danger ? styles.danger : null, disabled ? styles.disabled : null, compact ? { height: 28 } : null, style]}
      hitSlop={compact ? { top: 8, bottom: 8, left: 0, right: 0 } : undefined}
      activeOpacity={0.7}
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      {icon ? <MdiIcon name={icon} size={20} color={r.onInk} /> : null}
      <Text size={labelSize ?? (compact ? 16 : magType.button.size)} color={r.onInk} style={[styles.label, compact ? { fontWeight: '800' } : null, labelStyle]}>{label}</Text>
      {badge != null ? <View style={{ minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 7, backgroundColor: r.accent, justifyContent: 'center', alignItems: 'center' }}><Text size={12} color={r.onAccent} style={{ fontWeight: '800' }}>{badge}</Text></View> : null}
    </TouchableOpacity>
  )
})
