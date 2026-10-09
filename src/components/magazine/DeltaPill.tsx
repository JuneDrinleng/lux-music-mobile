/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo } from 'react'
import { View } from 'react-native'

import Text from '@/components/common/Text'
import { MdiIcon } from '@/components/common/MdiIcon'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { createStyle } from '@/utils/tools'

const useStyles = sharedLuxStyles((colors) => {
  const r = magazineRoles(colors)
  return createStyle({
    pill: {
      height: 26,
      paddingLeft: 7,
      paddingRight: 10,
      borderRadius: 999,
      backgroundColor: r.accent,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    down: {
      backgroundColor: r.accentSoft,
    },
    text: {
      fontWeight: '800',
    },
  })
})

export const DeltaPill = memo(({
  label,
  direction = 'up',
}: {
  label: string
  direction?: 'up' | 'down' | 'none'
}) => {
  const styles = useStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const down = direction === 'down'
  const textColor = down ? r.accentInk : r.onAccent
  return (
    <View style={[styles.pill, down ? styles.down : null]}>
      {direction === 'up'
        ? <MdiIcon name="arrow-up" size={14} color={textColor} />
        : direction === 'down'
          ? <MdiIcon name="arrow-down" size={14} color={textColor} />
          : null}
      <Text size={13} color={textColor} style={styles.text}>{label}</Text>
    </View>
  )
})
