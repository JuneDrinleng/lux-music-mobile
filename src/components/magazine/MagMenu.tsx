/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo } from 'react'
import { Modal, TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { createStyle } from '@/utils/tools'

export interface MagMenuItem {
  id: string
  label: string
}

const useStyles = sharedLuxStyles((colors) => {
  const r = magazineRoles(colors)
  return createStyle({
    root: {
      flex: 1,
    },
    card: {
      position: 'absolute',
      backgroundColor: r.paper,
      borderRadius: 4,
      borderWidth: 1.5,
      borderColor: r.ink,
      shadowColor: r.hairline,
      shadowOpacity: 1,
      shadowRadius: 0,
      shadowOffset: { width: 4, height: 4 },
      elevation: 0,
      minWidth: 160,
      overflow: 'hidden',
    },
    row: {
      height: 42,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    label: {
      fontWeight: '600',
    },
    labelOn: {
      fontWeight: '800',
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: r.accent,
    },
  })
})

export const MagMenu = memo(({
  visible,
  onClose,
  items,
  value,
  onChange,
  anchor,
}: {
  visible: boolean
  onClose: () => void
  items: readonly MagMenuItem[]
  value?: string
  onChange: (id: string) => void
  anchor: { top: number, left: number, width?: number }
}) => {
  const styles = useStyles()
  const { colors, mode } = useLuxTheme()
  const r = magazineRoles(colors)
  if (!visible) return null
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.root} activeOpacity={1} onPress={onClose}>
        <View style={[styles.card, { top: anchor.top, left: anchor.left, width: anchor.width }]}>
          {items.map(item => {
            const on = item.id === value
            return (
              <TouchableOpacity
                key={item.id}
                style={styles.row}
                activeOpacity={0.7}
                onPress={() => {
                  onChange(item.id)
                  onClose()
                }}
              >
                <Text size={14} color={r.ink} style={on ? styles.labelOn : styles.label}>{item.label}</Text>
                {on
                  ? (
                    <View style={[
                      styles.dot,
                      mode === 'light' ? { borderWidth: 1.5, borderColor: r.ink } : null,
                    ]} />
                    )
                  : null}
              </TouchableOpacity>
            )
          })}
        </View>
      </TouchableOpacity>
    </Modal>
  )
})
