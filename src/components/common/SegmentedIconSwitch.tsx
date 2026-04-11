// Lux Proprietary
import { useEffect, useMemo, useRef } from 'react'
import {
  Animated,
  Easing,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { createStyle } from '@/utils/tools'

export interface SegmentedIconSwitchItem {
  key: string
  accessibilityLabel?: string
  renderIcon: (active: boolean) => React.ReactNode
}

interface SegmentedIconSwitchProps {
  value: string
  items: SegmentedIconSwitchItem[]
  onChange: (value: string) => void
  style?: StyleProp<ViewStyle>
  itemWidth?: number
  itemHeight?: number
  padding?: number
  borderWidth?: number
  borderColor?: string
  backgroundColor?: string
  thumbColor?: string
  thumbBorderColor?: string
  thumbShadowColor?: string
  animationDuration?: number
}

export default ({
  value,
  items,
  onChange,
  style,
  itemWidth = 34,
  itemHeight = 28,
  padding = 3,
  borderWidth = 1,
  borderColor = '#d7deec',
  backgroundColor = '#e3e9f4',
  thumbColor = '#ffffff',
  thumbBorderColor = '#eef2f8',
  thumbShadowColor = '#687189',
  animationDuration = 188,
}: SegmentedIconSwitchProps) => {
  const activeIndex = Math.max(0, items.findIndex(item => item.key == value))
  const animatedIndex = useRef(new Animated.Value(activeIndex)).current
  const inputRange = useMemo(() => items.map((_, index) => index), [items])
  const outputRange = useMemo(
    () => items.map((_, index) => index * itemWidth),
    [items, itemWidth],
  )
  const containerWidth =
    itemWidth * items.length +
    padding * 2 +
    borderWidth * 2
  const containerHeight =
    itemHeight +
    padding * 2 +
    borderWidth * 2
  const thumbTranslateX = useMemo(() => {
    if (items.length <= 1) return new Animated.Value(0)
    return animatedIndex.interpolate({
      inputRange,
      outputRange,
      extrapolate: 'clamp',
    })
  }, [animatedIndex, inputRange, items.length, outputRange])

  useEffect(() => {
    Animated.timing(animatedIndex, {
      toValue: activeIndex,
      duration: animationDuration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [activeIndex, animatedIndex, animationDuration])

  return (
    <View
      style={[
        styles.container,
        {
          width: containerWidth,
          height: containerHeight,
          borderRadius: containerHeight / 2,
          borderWidth,
          borderColor,
          backgroundColor,
          padding,
        },
        style,
      ]}
    >
      <View style={styles.track}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.thumb,
            {
              width: itemWidth,
              borderRadius: itemHeight / 2,
              backgroundColor: thumbColor,
              borderColor: thumbBorderColor,
              shadowColor: thumbShadowColor,
              transform: [{ translateX: thumbTranslateX }],
            },
          ]}
        />
        {items.map(item => {
          const active = item.key == value
          return (
            <TouchableOpacity
              key={item.key}
              accessibilityRole="button"
              accessibilityLabel={item.accessibilityLabel}
              accessibilityState={{ selected: active }}
              activeOpacity={0.85}
              style={[
                styles.item,
                {
                  width: itemWidth,
                  height: itemHeight,
                  borderRadius: itemHeight / 2,
                },
              ]}
              onPress={() => { onChange(item.key) }}
            >
              {item.renderIcon(active)}
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

const styles = createStyle({
  container: {
    overflow: 'hidden',
  },
  track: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  thumb: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderWidth: 1,
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    elevation: 1,
  },
  item: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
})
