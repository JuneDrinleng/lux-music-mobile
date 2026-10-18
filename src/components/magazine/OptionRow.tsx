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
  description,
  leading = false,
  compact = false,
  disabled = false,
}: {
  label: string
  selected: boolean
  onPress: () => void
  last?: boolean
  description?: string
  compact?: boolean
  disabled?: boolean
  leading?: boolean
}) => {
  const styles = useStyles()
  const { colors, mode } = useLuxTheme()
  const r = magazineRoles(colors)
  return (
    <View>
      <TouchableOpacity
        style={[styles.row, leading ? { alignItems: 'flex-start', justifyContent: 'flex-start', paddingBottom: 0, borderBottomWidth: 1, borderBottomColor: r.hairline } : null, compact ? { minHeight: 28, paddingVertical: 3, paddingBottom: 3, marginVertical: 8 } : null]}
        hitSlop={compact ? { top: 8, bottom: 8, left: 0, right: 0 } : undefined}
        disabled={disabled}
        activeOpacity={0.7}
        onPress={onPress}
        accessibilityRole="radio"
        accessibilityState={{ selected, disabled }}
      >
        {leading ? <View style={[styles.dot, { marginTop: 6, borderWidth: 1.5, borderColor: r.ink, backgroundColor: selected ? r.accent : 'transparent' }]} /> : null}
        <View style={{ flex: 1 }}>
          <Text
            size={leading ? 15 : magType.rowTitle.size}
            color={leading ? r.list : selected ? r.ink : r.option}
            style={[styles.label, selected ? styles.labelOn : null, leading ? { fontWeight: '700' } : null]}
            numberOfLines={1}
          >{label}</Text>
          {description ? <Text size={12} color={r.muted} style={{ marginTop: 2 }}>{description}</Text> : null}
        </View>
        {selected && !leading
          ? (
            <View style={[
              styles.dot,
              mode === 'light' ? { borderWidth: 1.5, borderColor: r.ink } : null,
            ]} />
            )
          : null}
      </TouchableOpacity>
      {last || leading ? null : <Hairline />}
    </View>
  )
})
