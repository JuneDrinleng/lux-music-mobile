import { memo } from 'react'
import { type StyleProp, type TextStyle } from 'react-native'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'

import { scaleSizeW } from '@/utils/pixelRatio'
import { resolveMdiName } from './mdiIconMap'

export interface MdiIconProps {
  name: string
  /** Design size. Passed through the same width scale as `createStyle` widths. */
  size?: number
  /** Unscaled pixel size. Use when the previous icon was already a raw font size. */
  rawSize?: number
  color?: string
  style?: StyleProp<TextStyle>
  allowFontScaling?: boolean
}

export const MdiIcon = memo(({
  name,
  size = 15,
  rawSize,
  color,
  style,
  allowFontScaling,
}: MdiIconProps) => {
  return (
    <MaterialCommunityIcons
      name={resolveMdiName(name)}
      size={rawSize ?? scaleSizeW(size)}
      color={color}
      // @ts-expect-error vector-icons bundles its own react-native style types
      style={style}
      allowFontScaling={allowFontScaling}
    />
  )
})
