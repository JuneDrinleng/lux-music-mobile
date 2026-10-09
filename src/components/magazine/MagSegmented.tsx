/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo, type ReactNode } from 'react'
import { Pressable, View, type ViewStyle } from 'react-native'

import Text from '@/components/common/Text'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { createStyle } from '@/utils/tools'

import { MAG_SEGMENTED_COMPACT } from './magSegmentedLayout'
import { type MagTabItem } from './TextTabs'

/**
 * Ink-outlined segmented control (variant C).
 * Default: equal cells across the content width.
 * compact: shrink-wrap short labels; never inherits flex:1 (that collapsed labels to a
 * black/white square). Visual ~28pt; ≥44 hit via hitSlop.
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
      flexDirection: 'row',
      alignItems: 'stretch',
      borderWidth: MAG_SEGMENTED_COMPACT.borderWidth,
      borderColor: r.ink,
      overflow: 'hidden',
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
    /** Standalone compact cell — do not compose with `cell` (flex:1 collapses width). */
    cellCompact: {
      flexGrow: 0,
      flexShrink: 0,
      flexBasis: 'auto',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: MAG_SEGMENTED_COMPACT.paddingHorizontal,
      backgroundColor: 'transparent',
    },
    cellContent: {
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
    <View
      style={compact ? [styles.rowCompact, style] : [styles.row, style]}
      accessibilityRole="tablist"
    >
      {items.map((item, index) => {
        const on = item.id === value
        const labelColor = on ? r.paper : r.ink
        const label = (
          <Text
            size={compact ? MAG_SEGMENTED_COMPACT.labelSize : 13}
            color={labelColor}
            style={on ? styles.labelOn : styles.label}
            numberOfLines={1}
          >{item.label}</Text>
        )
        const body = renderItem
          ? (
            <View style={styles.cellContent}>
              {renderItem(item, on)}
            </View>
            )
          : (
            <View style={styles.cellContent}>
              {label}
            </View>
            )
        return (
          <Pressable
            key={item.id}
            style={({ pressed }) => [
              compact ? styles.cellCompact : styles.cell,
              index > 0 ? (compact ? styles.cellDividerCompact : styles.cellDivider) : null,
              on ? styles.cellOn : null,
              pressed ? { opacity: 0.7 } : null,
            ]}
            onPress={() => {
              if (item.id !== value) onChange(item.id)
            }}
            hitSlop={compact ? MAG_SEGMENTED_COMPACT.hitSlop : undefined}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={item.label}
          >
            {body}
          </Pressable>
        )
      })}
    </View>
  )
})
