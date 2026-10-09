/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo, type ReactNode } from 'react'
import { TouchableOpacity, View, type ViewStyle } from 'react-native'

import Text from '@/components/common/Text'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { createStyle } from '@/utils/tools'

import { type MagTabItem } from './TextTabs'

/**
 * Full-width ink-outlined segmented control (variant C).
 * Equal cells across the content width; selected = ink fill + paper text.
 * See docs/design-system-magazine.md §4.4 / home filter.
 */

const useStyles = sharedLuxStyles((colors) => {
  const r = magazineRoles(colors)
  return createStyle({
    row: {
      flexDirection: 'row',
      borderWidth: 1.5,
      borderColor: r.ink,
      overflow: 'hidden',
      alignSelf: 'stretch',
    },
    rowCompact: {
      alignSelf: 'flex-start',
    },
    cell: {
      flex: 1,
      minHeight: 36,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      paddingHorizontal: 2,
      backgroundColor: 'transparent',
    },
    cellCompact: {
      flexGrow: 0,
      flexShrink: 0,
      minHeight: 36,
      paddingHorizontal: 12,
      flexDirection: 'row',
      gap: 4,
    },
    cellOn: {
      backgroundColor: r.ink,
    },
    cellDivider: {
      borderLeftWidth: 1.5,
      borderLeftColor: r.ink,
    },
    label: {
      fontWeight: '600',
    },
    labelOn: {
      fontWeight: '800',
    },
  })
})

export const MagSegmented = memo(({
  items,
  value,
  onChange,
  style,
  compact = false,
  renderItem,
}: {
  items: readonly MagTabItem[]
  value: string
  onChange: (id: string) => void
  style?: ViewStyle
  /** Shrink-wrap cells (library grid|list). Default stretches full width. */
  compact?: boolean
  renderItem?: (item: MagTabItem, selected: boolean) => ReactNode
}) => {
  const styles = useStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  return (
    <View style={[styles.row, compact ? styles.rowCompact : null, style]} accessibilityRole="tablist">
      {items.map((item, index) => {
        const on = item.id === value
        return (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.cell,
              compact ? styles.cellCompact : null,
              index > 0 ? styles.cellDivider : null,
              on ? styles.cellOn : null,
            ]}
            activeOpacity={0.7}
            onPress={() => {
              if (item.id !== value) onChange(item.id)
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={item.label}
          >
            {renderItem
              ? renderItem(item, on)
              : (
                <Text
                  size={13}
                  color={on ? r.paper : r.ink}
                  style={on ? styles.labelOn : styles.label}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                >{item.label}</Text>
                )}
          </TouchableOpacity>
        )
      })}
    </View>
  )
})
