/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo } from 'react'
import { View, type ViewStyle } from 'react-native'

import { sharedLuxStyles } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { createStyle } from '@/utils/tools'

const useStyles = sharedLuxStyles((colors) => {
  const r = magazineRoles(colors)
  return createStyle({
    hairline: {
      height: 1,
      backgroundColor: r.hairline,
    },
  })
})

export const Hairline = memo(({ style }: { style?: ViewStyle }) => {
  const styles = useStyles()
  return <View style={[styles.hairline, style]} />
})
