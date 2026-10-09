/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

// Lux Proprietary

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Animated, Easing } from 'react-native'

/** Same open/close as PlaylistDetailView. Local songs use overlaySlideTransition (stats-style) instead. */
export const DETAIL_SCENE_OPEN_MS = 280
export const DETAIL_SCENE_CLOSE_MS = 200
export const DETAIL_SCENE_RISE = 24
export const DETAIL_SCENE_OPEN_EASING = Easing.bezier(0.36, 0.66, 0.04, 1)
export const DETAIL_SCENE_CLOSE_EASING = Easing.bezier(0.32, 0.72, 0, 1)

export const useDetailSceneTransition = (restartKey?: string | null) => {
  const progress = useRef(new Animated.Value(0)).current
  const tokenRef = useRef(0)
  const closingRef = useRef(false)

  useEffect(() => {
    closingRef.current = false
    tokenRef.current += 1
    progress.stopAnimation()
    progress.setValue(0)
    Animated.timing(progress, {
      toValue: 1,
      duration: DETAIL_SCENE_OPEN_MS,
      easing: DETAIL_SCENE_OPEN_EASING,
      useNativeDriver: true,
    }).start()
  }, [progress, restartKey])

  const requestClose = useCallback((onClosed?: () => void) => {
    if (closingRef.current) return
    closingRef.current = true
    const token = ++tokenRef.current
    progress.stopAnimation()
    Animated.timing(progress, {
      toValue: 0,
      duration: DETAIL_SCENE_CLOSE_MS,
      easing: DETAIL_SCENE_CLOSE_EASING,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (token != tokenRef.current) return
      if (finished) onClosed?.()
    })
  }, [progress])

  const style = useMemo(() => ({
    opacity: progress.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    }),
    transform: [{
      translateY: progress.interpolate({
        inputRange: [0, 1],
        outputRange: [DETAIL_SCENE_RISE, 0],
      }),
    }],
  }), [progress])

  return { style, requestClose }
}
