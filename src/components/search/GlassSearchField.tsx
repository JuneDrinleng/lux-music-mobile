import { type ReactNode } from 'react'
import { Animated, Platform, StyleSheet, UIManager, View, type StyleProp, type ViewStyle } from 'react-native'
import { BlurView } from '@react-native-community/blur'

import { createStyle } from '@/utils/tools'

const hasNativeBlurView = Boolean(UIManager.getViewManagerConfig?.(Platform.OS === 'ios' ? 'BlurView' : 'AndroidBlurView'))

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
      {hasNativeBlurView
        ? <>
            <BlurView
              style={StyleSheet.absoluteFillObject}
              blurType={Platform.OS === 'ios' ? 'chromeMaterialLight' : 'light'}
              blurAmount={Platform.OS === 'ios' ? 34 : 24}
              blurRadius={Platform.OS === 'android' ? 24 : undefined}
              downsampleFactor={Platform.OS === 'android' ? 6 : undefined}
              overlayColor={Platform.OS === 'android' ? 'rgba(255,255,255,0.16)' : 'transparent'}
              reducedTransparencyFallbackColor="rgba(255,255,255,0.72)"
            />
            <View style={styles.glassTint} pointerEvents="none" />
          </>
        : <View style={styles.glassFallback} pointerEvents="none" />}
      <View style={styles.glassRim} pointerEvents="none" />
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
    borderColor: 'rgba(244,247,252,0.58)',
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  glassTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  glassFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.62)',
  },
  glassRim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  content: {
    flex: 1,
    paddingLeft: 14,
    paddingRight: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
})
