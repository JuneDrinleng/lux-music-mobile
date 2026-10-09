/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo, useEffect, useRef, useState } from 'react'
import { Animated, Easing, StyleSheet, View } from 'react-native'
import { HOME_BOOT_SPLASH_FADE_MS } from '@/utils/homeBootGate'
import { notifyHomeBootSplashHidden, shouldShowHomeBootSplash, subscribeHomeBootReveal } from '@/utils/homeFirstScreenBoot'
import Launch from './index'

const HomeBootSplash = memo(() => {
  const opacity = useRef(new Animated.Value(1)).current
  const [mounted, setMounted] = useState(shouldShowHomeBootSplash)

  useEffect(() => {
    if (!mounted) return
    return subscribeHomeBootReveal(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: HOME_BOOT_SPLASH_FADE_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        setMounted(false)
        notifyHomeBootSplashHidden()
      })
    })
  }, [mounted, opacity])

  if (!mounted) return null

  return (
    <Animated.View pointerEvents="auto" style={[styles.cover, { opacity }]}>
      <View style={styles.fill}>
        <Launch />
      </View>
    </Animated.View>
  )
})

const styles = StyleSheet.create({
  cover: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 80,
    elevation: 32,
  },
  fill: {
    flex: 1,
  },
})

export default HomeBootSplash
