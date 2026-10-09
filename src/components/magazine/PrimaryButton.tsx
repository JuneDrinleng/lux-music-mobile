/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo } from 'react'
import { TouchableOpacity, type ViewStyle } from 'react-native'

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
}: {
  label: string
  onPress?: () => void
  disabled?: boolean
  danger?: boolean
  icon?: string
  style?: ViewStyle
}) => {
  const styles = useStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  return (
    <TouchableOpacity
      style={[styles.btn, danger ? styles.danger : null, disabled ? styles.disabled : null, style]}
      activeOpacity={0.7}
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      {icon ? <MdiIcon name={icon} size={20} color={r.onInk} /> : null}
      <Text size={magType.button.size} color={r.onInk} style={styles.label}>{label}</Text>
    </TouchableOpacity>
  )
})
