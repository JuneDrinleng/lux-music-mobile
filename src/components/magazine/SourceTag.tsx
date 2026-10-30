/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo } from 'react'
import { View } from 'react-native'

import Text from '@/components/common/Text'
import { getSourceTone } from '@/components/search/sourceTone'
import { useLuxTheme } from '@/theme/LuxTheme'

/** Outlined source chip: ink + 1px same-color border, no fill. §4.7 / §3.1. */
export const SourceTag = memo(({
  source,
  label,
  neutral = false,
}: {
  source: string
  label: string
  neutral?: boolean
}) => {
  const { colors } = useLuxTheme()
  const tone = neutral ? { text: colors.ink.secondary } : getSourceTone(source, colors)
  return (
    <View style={{
      borderWidth: 1,
      borderColor: tone.text,
      borderRadius: 3,
      paddingHorizontal: neutral ? 3 : 4,
      paddingVertical: neutral ? 0 : 1,
      alignSelf: 'flex-start',
    }}>
      <Text size={10} color={tone.text} style={{ fontWeight: '700', includeFontPadding: false, lineHeight: neutral ? 14 : undefined }}>{label}</Text>
    </View>
  )
})
