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
  compact = false,
  accessibilityLabel,
}: {
  value: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
  compact?: boolean
  accessibilityLabel?: string
}) => {
  const { colors, mode } = useLuxTheme()
  const r = magazineRoles(colors)
  const thumbOutline = value && mode === 'light'
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      hitSlop={compact ? { top: 10, bottom: 10, left: 2, right: 2 } : undefined}
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={() => { onChange(!value) }}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      style={{
        width: compact ? 40 : 44,
        height: compact ? 24 : 26,
        borderRadius: 999,
        borderWidth: compact ? 0 : 1.5,
        borderColor: value ? r.ink : compact ? r.hairline : r.quiet,
        backgroundColor: value ? r.ink : compact ? r.hairline : 'transparent',
        justifyContent: 'center',
        paddingHorizontal: 3,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <View style={{
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: value ? r.accent : compact ? r.onInk : r.quiet,
        alignSelf: value ? 'flex-end' : 'flex-start',
        borderWidth: thumbOutline && !compact ? 1.5 : 0,
        borderColor: r.ink,
      }} />
    </TouchableOpacity>
  )
})
