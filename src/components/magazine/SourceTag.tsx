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
}: {
  source: string
  label: string
}) => {
  const { colors } = useLuxTheme()
  const tone = getSourceTone(source, colors)
  return (
    <View style={{
      borderWidth: 1,
      borderColor: tone.text,
      borderRadius: 3,
      paddingHorizontal: 4,
      paddingVertical: 1,
      alignSelf: 'flex-start',
    }}>
      <Text size={10} color={tone.text} style={{ fontWeight: '700', includeFontPadding: false }}>{label}</Text>
    </View>
  )
})
