/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo } from 'react'
import { TouchableOpacity } from 'react-native'

import { MdiIcon } from '@/components/common/MdiIcon'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { createStyle } from '@/utils/tools'

const useStyles = sharedLuxStyles((colors) => {
  const r = magazineRoles(colors)
  return createStyle({
    back: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: r.ink,
      backgroundColor: 'transparent',
    },
  })
})

export const BackButton = memo(({
  onPress,
  icon = 'chevron-left',
  accessibilityLabel,
}: {
  onPress: () => void
  icon?: 'chevron-left' | 'chevron-down'
  accessibilityLabel?: string
}) => {
  const styles = useStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  return (
    <TouchableOpacity
      style={styles.back}
      activeOpacity={0.7}
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <MdiIcon name={icon} size={22} color={r.ink} />
    </TouchableOpacity>
  )
})
