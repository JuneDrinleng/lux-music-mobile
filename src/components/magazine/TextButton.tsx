/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo } from 'react'
import { TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native'

import Text from '@/components/common/Text'
import { useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { magType } from '@/theme/magazineType'

export const TextButton = memo(({
  label,
  style,
  compact = false,
  onPress,
  disabled = false,
  muted = false,
  danger = false,
  underline = true,
}: {
  label: string
  style?: StyleProp<ViewStyle>
  compact?: boolean
  onPress?: () => void
  disabled?: boolean
  muted?: boolean
  danger?: boolean
  underline?: boolean
}) => {
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const color = danger ? r.danger : muted ? r.muted : disabled ? r.faint : r.ink
  return (
    <TouchableOpacity
      hitSlop={compact ? { top: 13, bottom: 13, left: 0, right: 0 } : undefined}
      activeOpacity={0.7}
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={[{ opacity: disabled ? 0.55 : 1, minHeight: compact ? 18 : 44, justifyContent: 'center' }, style]}
    >
      <Text
        size={compact ? 14 : magType.textButton.size}
        color={color}
        style={{
          fontWeight: '700',
          textDecorationLine: underline && !muted ? 'underline' : 'none',
          textDecorationColor: color,
        }}
      >{label}</Text>
    </TouchableOpacity>
  )
})
