import { type ReactNode } from 'react'
import { Animated, View, type StyleProp, type ViewStyle } from 'react-native'

import { createStyle } from '@/utils/tools'
import { sharedLuxStyles } from '@/theme/LuxTheme'
import { type LuxColors } from '@/theme/luxTokens'

export default ({
  children,
  style,
  contentStyle,
  animatedContentStyle,
}: {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  contentStyle?: StyleProp<ViewStyle>
  animatedContentStyle?: any
}) => {
  const styles = useLuxStyles()

  const content: any = [
    styles.content,
    contentStyle,
    animatedContentStyle,
  ]

  return (
    <View style={[styles.field, style]}>
      {animatedContentStyle
        ? <Animated.View style={content}>{children}</Animated.View>
        : <View style={content}>{children}</View>}
    </View>
  )
}

const useLuxStyles = sharedLuxStyles((colors: LuxColors) => (createStyle({
  field: {
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.searchField.border,
    backgroundColor: colors.surface.search,
  },
  content: {
    flex: 1,
    paddingLeft: 14,
    paddingRight: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
})))
