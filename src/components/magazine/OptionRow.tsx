/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo } from 'react'
import { TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { OPTION_ROW_MIN_HEIGHT, magType } from '@/theme/magazineType'
import { createStyle } from '@/utils/tools'

import { Hairline } from './Hairline'

const useStyles = sharedLuxStyles((colors) => {
  const r = magazineRoles(colors)
  return createStyle({
    row: {
      minHeight: OPTION_ROW_MIN_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      gap: 12,
    },
    label: {
      flex: 1,
      minWidth: 0,
      fontWeight: '600',
    },
    labelOn: {
      fontWeight: '800',
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: r.accent,
      flexShrink: 0,
    },
  })
})

export const OptionRow = memo(({
  label,
  selected,
  onPress,
  last = false,
}: {
  label: string
  selected: boolean
  onPress: () => void
  last?: boolean
}) => {
  const styles = useStyles()
  const { colors, mode } = useLuxTheme()
  const r = magazineRoles(colors)
  return (
    <View>
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.7}
        onPress={onPress}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
      >
        <Text
          size={magType.rowTitle.size}
          color={selected ? r.ink : r.option}
          style={[styles.label, selected ? styles.labelOn : null]}
          numberOfLines={1}
        >{label}</Text>
        {selected
          ? (
            <View style={[
              styles.dot,
              mode === 'light' ? { borderWidth: 1.5, borderColor: r.ink } : null,
            ]} />
            )
          : null}
      </TouchableOpacity>
      {last ? null : <Hairline />}
    </View>
  )
})
