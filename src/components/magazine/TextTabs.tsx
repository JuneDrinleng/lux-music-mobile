/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo } from 'react'
import { ScrollView, TouchableOpacity, View, type ViewStyle } from 'react-native'

import Text from '@/components/common/Text'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { magType } from '@/theme/magazineType'
import { createStyle } from '@/utils/tools'

export interface MagTabItem {
  id: string
  label: string
}

const useStyles = sharedLuxStyles((colors) => {
  const r = magazineRoles(colors)
  return createStyle({
    tabs: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: r.hairline,
      gap: 22,
    },
    tabsSm: {
      gap: 18,
    },
    tab: {
      paddingBottom: 10,
    },
    tabOn: {
      borderBottomWidth: 3,
      borderBottomColor: r.ink,
      borderBottomLeftRadius: 2,
      borderBottomRightRadius: 2,
      marginBottom: -1,
    },
    label: {
      fontWeight: '600',
    },
    labelOn: {
      fontWeight: '800',
    },
  })
})

export const TextTabs = memo(({
  items,
  value,
  onChange,
  small = false,
  scroll = false,
  style,
}: {
  items: readonly MagTabItem[]
  value: string
  onChange: (id: string) => void
  small?: boolean
  scroll?: boolean
  style?: ViewStyle
}) => {
  const styles = useStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const size = small ? magType.tabSm.size : magType.tab.size

  const row = (
    <View style={[styles.tabs, small ? styles.tabsSm : null, style]}>
      {items.map(item => {
        const on = item.id === value
        return (
          <TouchableOpacity
            key={item.id}
            style={[styles.tab, on ? styles.tabOn : null]}
            activeOpacity={0.7}
            onPress={() => onChange(item.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
          >
            <Text
              size={size}
              color={on ? r.ink : r.quiet}
              style={on ? styles.labelOn : styles.label}
            >{item.label}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )

  if (!scroll) return row
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false}>
      {row}
    </ScrollView>
  )
})
