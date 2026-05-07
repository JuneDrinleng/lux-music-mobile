import { type ReactNode } from 'react'
import { Animated, View, type StyleProp, type ViewStyle } from 'react-native'

import { createStyle } from '@/utils/tools'

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

const styles = createStyle({
  field: {
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#cdd2de',
    backgroundColor: '#dce0e9',
  },
  content: {
    flex: 1,
    paddingLeft: 14,
    paddingRight: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
})
