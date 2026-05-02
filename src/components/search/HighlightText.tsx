import { memo } from 'react'
import Text from '@/components/common/Text'

const HIGHLIGHT_COLOR = '#85b300'

export default memo(({ text, keyword, size, color, style, numberOfLines }: {
  text: string
  keyword: string
  size: number
  color: string
  numberOfLines?: number
  style?: any
}) => {
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
          ? <Text key={index} size={size} color={HIGHLIGHT_COLOR}>{part}</Text>
          : <Text key={index} size={size} color={color}>{part}</Text>
      )}
    </Text>
  )
})
