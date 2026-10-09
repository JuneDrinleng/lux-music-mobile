/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo, type ReactNode } from 'react'
import { TouchableOpacity, type ViewStyle } from 'react-native'

import { MdiIcon } from '@/components/common/MdiIcon'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { createStyle } from '@/utils/tools'

export const ICON_BUTTON_SIZE = 44

/**
 * Shared ≥44pt icon-only control. Pass accessibilityLabel for every use.
 * See docs/design-system-magazine.md §10 (tap targets).
 */
export const IconButton = memo(({
  name,
  onPress,
  accessibilityLabel,
  size = 24,
  color,
  disabled,
  style,
  children,
}: {
  name?: string
  onPress?: () => void
  accessibilityLabel: string
  size?: number
  color?: string
  disabled?: boolean
  style?: ViewStyle
  children?: ReactNode
}) => {
  const styles = useStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  return (
    <TouchableOpacity
      style={[styles.btn, style]}
      activeOpacity={0.7}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled) }}
    >
      {children ?? (name
        ? <MdiIcon name={name} size={size} color={color ?? r.ink} />
        : null)}
    </TouchableOpacity>
  )
})

const useStyles = sharedLuxStyles(() => createStyle({
  btn: {
    width: ICON_BUTTON_SIZE,
    height: ICON_BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
}))
