/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo } from 'react'
import Text from '@/components/common/Text'
import { useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'

export default memo(({ text, keyword, size, color, style, numberOfLines }: {
  text: string
  keyword: string
  size: number
  color: string
  numberOfLines?: number
  style?: any
}) => {
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)

  if (!keyword) {
    return <Text size={size} color={color} style={style} numberOfLines={numberOfLines}>{text}</Text>
  }
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')
  const parts = text.split(regex)
  return (
    <Text size={size} color={color} style={style} numberOfLines={numberOfLines}>
      {parts.map((part, index) =>
        part.toLowerCase() === keyword.toLowerCase()
          ? (
            <Text
              key={index}
              size={size}
              color={color}
              style={{ backgroundColor: r.accentSoft }}
            >{part}</Text>
            )
          : <Text key={index} size={size} color={color}>{part}</Text>,
      )}
    </Text>
  )
})
