/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo } from 'react'
import { View } from 'react-native'
import Svg, { Text as SvgText } from 'react-native-svg'

import Text from '@/components/common/Text'
import { useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { magType } from '@/theme/magazineType'

/**
 * Editorial rank: #1 solid display; #2–#5 hollow stroke (svg); 6+ as 15/700 index.
 * Falls back to weight 300 + faint when svg stroke fails to mount.
 */
export const RankNumber = memo(({
  rank,
  width = 38,
}: {
  rank: number
  width?: number
}) => {
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const label = String(rank)

  if (rank >= 6) {
    return (
      <View style={{ width, alignItems: 'flex-start' }}>
        <Text
          size={magType.index.size}
          color={r.faint}
          style={{ fontWeight: '700', fontVariant: ['tabular-nums'] }}
        >{rank < 10 ? `0${rank}` : label}</Text>
      </View>
    )
  }

  if (rank === 1) {
    return (
      <View style={{ width, alignItems: 'flex-start' }}>
        <Text
          size={magType.rank.size}
          color={r.display}
          style={{
            fontWeight: '800',
            letterSpacing: -1,
            fontVariant: ['tabular-nums'],
            includeFontPadding: false,
          }}
        >{label}</Text>
      </View>
    )
  }

  // #2–#5 hollow stroke via svg; weight-300 faint is the low-end fallback if stroke fails to paint.
  return (
    <View style={{ width, height: magType.rank.size, justifyContent: 'center' }}>
      <Text
        size={magType.rank.size}
        color={r.faint}
        style={{
          position: 'absolute',
          fontWeight: '300',
          letterSpacing: -1,
          fontVariant: ['tabular-nums'],
          includeFontPadding: false,
        }}
      >{label}</Text>
      <Svg width={width} height={magType.rank.size}>
        <SvgText
          x={0}
          y={magType.rank.size - 4}
          fill="none"
          stroke={r.faint}
          strokeWidth={1.1}
          fontSize={magType.rank.size}
          fontWeight="800"
          letterSpacing={-1}
        >{label}</SvgText>
      </Svg>
    </View>
  )
})
