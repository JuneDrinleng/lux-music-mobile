/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo } from 'react'
import { TouchableOpacity, View } from 'react-native'

import { MdiIcon } from '@/components/common/MdiIcon'
import { useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'

/** 20×20, 1.5px ink rim, r3; checked = ink fill + paper check. §4.11. */
export const Checkbox = memo(({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean
  onChange?: (next: boolean) => void
  disabled?: boolean
}) => {
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const body = (
    <View style={{
      width: 20,
      height: 20,
      borderRadius: 3,
      borderWidth: 1.5,
      borderColor: r.ink,
      backgroundColor: checked ? r.ink : 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
      opacity: disabled ? 0.4 : 1,
    }}>
      {checked ? <MdiIcon name="check" size={14} color={r.paper} /> : null}
    </View>
  )
  if (!onChange) return body
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      disabled={disabled}
      onPress={() => { onChange(!checked) }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
    >
      {body}
    </TouchableOpacity>
  )
})
