/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo } from 'react'
import { View, type ViewStyle } from 'react-native'

import { sharedLuxStyles } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { RULE_GAP, RULE_GAP_COMPACT } from '@/theme/magazineType'
import { createStyle } from '@/utils/tools'

const useStyles = sharedLuxStyles((colors) => {
  const r = magazineRoles(colors)
  return createStyle({
    rule: {
      height: 1,
      backgroundColor: r.ink,
      opacity: 0.9,
    },
  })
})

export const Rule = memo(({
  compact = false,
  style,
  gapTop,
}: {
  compact?: boolean
  style?: ViewStyle
  gapTop?: number
}) => {
  const styles = useStyles()
  const marginTop = gapTop ?? (compact ? RULE_GAP_COMPACT : RULE_GAP)
  return <View style={[styles.rule, { marginTop }, style]} />
})
