/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo, type ReactNode } from 'react'
import { TouchableOpacity, View, type ViewStyle } from 'react-native'

import Text from '@/components/common/Text'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { createStyle } from '@/utils/tools'

import { MAG_SEGMENTED_COMPACT } from './magSegmentedLayout'
import { type MagTabItem } from './TextTabs'

/**
 * Ink-outlined segmented control (variant C).
 * Default: equal cells across the content width.
 * compact: shrink-wrap two short labels (library grid|list); visual ~28pt, hit via hitSlop.
 * Selected = ink fill + paper text. See docs/design-system-magazine.md §4.4 / home filter.
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
      borderWidth: MAG_SEGMENTED_COMPACT.borderWidth,
      height: MAG_SEGMENTED_COMPACT.visualHeight,
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
      // Override cell's flex:1 explicitly — do not leave flexBasis:0 (collapses labels).
      flexGrow: MAG_SEGMENTED_COMPACT.cellFlex.flexGrow,
      flexShrink: MAG_SEGMENTED_COMPACT.cellFlex.flexShrink,
      flexBasis: MAG_SEGMENTED_COMPACT.cellFlex.flexBasis,
      minHeight: 0,
      height: '100%',
      paddingVertical: MAG_SEGMENTED_COMPACT.paddingVertical,
      paddingHorizontal: MAG_SEGMENTED_COMPACT.paddingHorizontal,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: MAG_SEGMENTED_COMPACT.gap,
    },
    cellOn: {
      backgroundColor: r.ink,
    },
    cellDivider: {
      borderLeftWidth: 1.5,
      borderLeftColor: r.ink,
    },
    cellDividerCompact: {
      borderLeftWidth: MAG_SEGMENTED_COMPACT.borderWidth,
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
        const labelColor = on ? r.paper : r.ink
        return (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.cell,
              compact ? styles.cellCompact : null,
              index > 0 ? (compact ? styles.cellDividerCompact : styles.cellDivider) : null,
              on ? styles.cellOn : null,
            ]}
            activeOpacity={0.7}
            onPress={() => {
              if (item.id !== value) onChange(item.id)
            }}
            hitSlop={compact ? MAG_SEGMENTED_COMPACT.hitSlop : undefined}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={item.label}
          >
            {renderItem
              ? renderItem(item, on)
              : (
                <Text
                  size={compact ? MAG_SEGMENTED_COMPACT.labelSize : 13}
                  color={labelColor}
                  style={on ? styles.labelOn : styles.label}
                  numberOfLines={1}
                >{item.label}</Text>
                )}
          </TouchableOpacity>
        )
      })}
    </View>
  )
})
