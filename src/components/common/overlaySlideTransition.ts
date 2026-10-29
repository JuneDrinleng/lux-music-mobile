/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Animated, Easing } from 'react-native'

/** Same open/close as ListeningStatsPage (PlaylistTab 「统计」). */
export const OVERLAY_SLIDE_OPEN_MS = 248
export const OVERLAY_SLIDE_CLOSE_MS = 220
export const OVERLAY_SLIDE_OPEN_EASING = Easing.bezier(0.22, 0.84, 0.22, 1)
export const OVERLAY_SLIDE_CLOSE_EASING = Easing.bezier(0.4, 0, 0.2, 1)
export const OVERLAY_SLIDE_OPEN_OPACITY = 0.92

/**
 * Horizontal slide overlay used by 听歌统计 and 本地歌曲.
 * Entry: full width from the right; exit: reverse. Back callers should run
 * `requestClose` then unmount on the finished callback (no edge swipe).
 */
export const useOverlaySlideTransition = (width: number, { symmetric = false, autoOpen = true }: { symmetric?: boolean, autoOpen?: boolean } = {}) => {
  const progress = useRef(new Animated.Value(0)).current
  const closingRef = useRef(false)
  const tokenRef = useRef(0)

  const requestOpen = useCallback(() => {
    closingRef.current = false
    tokenRef.current += 1
    progress.stopAnimation()
    progress.setValue(0)
    Animated.timing(progress, {
      toValue: 1,
      duration: OVERLAY_SLIDE_OPEN_MS,
      easing: OVERLAY_SLIDE_OPEN_EASING,
      useNativeDriver: true,
    }).start()
  }, [progress])

  useEffect(() => {
    if (autoOpen) requestOpen()
    return () => {
      tokenRef.current += 1
      progress.stopAnimation()
    }
  }, [autoOpen, progress, requestOpen])

  const requestClose = useCallback((onClosed?: () => void) => {
    if (closingRef.current) return
    closingRef.current = true
    const token = ++tokenRef.current
    progress.stopAnimation()
    Animated.timing(progress, {
      toValue: 0,
      duration: symmetric ? OVERLAY_SLIDE_OPEN_MS : OVERLAY_SLIDE_CLOSE_MS,
      easing: symmetric ? OVERLAY_SLIDE_OPEN_EASING : OVERLAY_SLIDE_CLOSE_EASING,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (token != tokenRef.current) return
      if (finished) onClosed?.()
    })
  }, [progress, symmetric])

  const style = useMemo(() => ({
    opacity: progress.interpolate({
      inputRange: [0, 1],
      outputRange: [OVERLAY_SLIDE_OPEN_OPACITY, 1],
    }),
    transform: [{
      translateX: progress.interpolate({
        inputRange: [0, 1],
        outputRange: [width, 0],
      }),
    }],
  }), [progress, width])

  return { style, requestClose, requestOpen, progress }
}
