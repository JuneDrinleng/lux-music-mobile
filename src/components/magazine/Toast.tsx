/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo } from 'react'
import { View } from 'react-native'

import Text from '@/components/common/Text'
import { MdiIcon } from '@/components/common/MdiIcon'
import { useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'

/** Visual toast chip for magazine surfaces. Host wiring stays in tools.toast for now. */
export const MagToast = memo(({
  message,
  tone = 'default',
  icon,
}: {
  message: string
  tone?: 'default' | 'danger'
  icon?: string
}) => {
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const bg = tone === 'danger' ? r.danger : r.ink
  return (
    <View style={{
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: bg,
      borderRadius: 4,
      paddingHorizontal: 12,
      paddingVertical: 10,
      maxWidth: '86%',
    }}>
      {icon ? <MdiIcon name={icon} size={16} color={r.onInk} /> : null}
      <Text size={13} color={r.onInk} style={{ fontWeight: '600', flexShrink: 1 }}>{message}</Text>
    </View>
  )
})
