/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo } from 'react'
import { TouchableOpacity, View } from 'react-native'

import { useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'

/** 44×26 capsule switch. Off: quiet rim + quiet thumb. On: ink fill + accent thumb. §4.11. */
export const Toggle = memo(({
  value,
  onChange,
  disabled = false,
}: {
  value: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
}) => {
  const { colors, mode } = useLuxTheme()
  const r = magazineRoles(colors)
  const thumbOutline = value && mode === 'light'
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      disabled={disabled}
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      style={{
        width: 44,
        height: 26,
        borderRadius: 999,
        borderWidth: 1.5,
        borderColor: value ? r.ink : r.quiet,
        backgroundColor: value ? r.ink : 'transparent',
        justifyContent: 'center',
        paddingHorizontal: 3,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <View style={{
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: value ? r.accent : r.quiet,
        alignSelf: value ? 'flex-end' : 'flex-start',
        borderWidth: thumbOutline ? 1.5 : 0,
        borderColor: r.ink,
      }} />
    </TouchableOpacity>
  )
})
