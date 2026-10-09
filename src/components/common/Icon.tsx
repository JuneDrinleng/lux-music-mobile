import { createIconSetFromIcoMoon } from 'react-native-vector-icons'
import icoMoonConfig from '@/resources/fonts/selection.json'
import { scaleSizeW } from '@/utils/pixelRatio'
import { memo, type ComponentProps } from 'react'
import { useTextShadow, useTheme } from '@/store/theme/hook'
import { StyleSheet, type StyleProp, type TextStyle } from 'react-native'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'

import { resolveMdiName } from './mdiIconMap'

const IcoMoon = createIconSetFromIcoMoon(icoMoonConfig)

type IconType = ReturnType<typeof createIconSetFromIcoMoon>

interface IconProps extends Omit<ComponentProps<IconType>, 'style'> {
  style?: StyleProp<TextStyle>
  rawSize?: number
}

export const Icon = memo(({ size = 15, rawSize, color, style, name, ...props }: IconProps) => {
  const theme = useTheme()
  const textShadow = useTextShadow()
  const newStyle = textShadow ? StyleSheet.compose({
    textShadowColor: theme['c-primary-dark-300-alpha-800'],
    textShadowOffset: { width: 0.2, height: 0.2 },
    textShadowRadius: 2,
  }, style) : style
  const glyphSize = rawSize ?? scaleSizeW(size)
  const glyphColor = color ?? theme['c-font']

  // The drawer / aside mark is the app logo, not a generic UI glyph.
  if (name === 'logo') {
    return (
      <IcoMoon
        name="logo"
        size={glyphSize}
        color={glyphColor}
        // @ts-expect-error icomoon style typing does not accept composed text styles
        style={newStyle}
        {...props}
      />
    )
  }

  return (
    <MaterialCommunityIcons
      name={resolveMdiName(name)}
      size={glyphSize}
      color={glyphColor}
      // @ts-expect-error vector-icons bundles its own react-native style types
      style={newStyle}
      {...props}
    />
  )
})
