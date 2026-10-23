/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo } from 'react'
import { TouchableOpacity, type ViewStyle } from 'react-native'

import Text from '@/components/common/Text'
import { MdiIcon } from '@/components/common/MdiIcon'
import { useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { magType } from '@/theme/magazineType'

export const SecondaryButton = memo(({
  label,
  onPress,
  disabled = false,
  icon,
  style,
  compact = false,
  labelSize,
  labelNumberOfLines,
  selected = false,
  danger = false,
}: {
  label: string
  onPress?: () => void
  disabled?: boolean
  icon?: string
  style?: ViewStyle
  compact?: boolean
  labelSize?: number
  labelNumberOfLines?: number
  selected?: boolean
  danger?: boolean
}) => {
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  return (
    <TouchableOpacity
      style={[{
        height: compact ? 28 : 44,
        borderRadius: 999,
        borderWidth: 1.5,
        borderColor: danger ? r.like : r.ink,
        backgroundColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 6,
        paddingHorizontal: 18,
        opacity: disabled ? 0.4 : 1,
      }, style]}
      hitSlop={compact ? { top: 8, bottom: 8, left: 0, right: 0 } : undefined}
      activeOpacity={0.7}
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
    >
      {icon ? <MdiIcon name={icon} size={20} color={danger ? r.like : r.ink} /> : null}
      <Text numberOfLines={labelNumberOfLines} size={labelSize ?? (compact ? 13 : magType.button.size)} color={danger ? r.like : r.ink} style={{ fontWeight: '700' }}>{label}</Text>
    </TouchableOpacity>
  )
})
