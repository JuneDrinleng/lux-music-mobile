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
}: {
  label: string
  onPress?: () => void
  disabled?: boolean
  icon?: string
  style?: ViewStyle
}) => {
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  return (
    <TouchableOpacity
      style={[{
        height: 44,
        borderRadius: 999,
        borderWidth: 1.5,
        borderColor: r.ink,
        backgroundColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 6,
        paddingHorizontal: 18,
        opacity: disabled ? 0.4 : 1,
      }, style]}
      activeOpacity={0.7}
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      {icon ? <MdiIcon name={icon} size={20} color={r.ink} /> : null}
      <Text size={magType.button.size} color={r.ink} style={{ fontWeight: '700' }}>{label}</Text>
    </TouchableOpacity>
  )
})
