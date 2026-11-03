/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Animated, Easing } from 'react-native'
import { STAGGER_GAP_MS, STAGGER_LIMIT, STAGGER_ROW_MS, staggerWindow } from './asyncAppearMath'

/** One native clock for the first visible batch; never replay on scroll/refresh. */
export const useStaggeredAppear = (reducedMotion: boolean) => {
  const clock = useRef(new Animated.Value(0)).current
  const claimed = useRef(false)
  const [batch, setBatch] = useState<readonly string[] | null>(null)
  const reveal = useCallback((keys: string[]) => {
    if (claimed.current) return
    claimed.current = true
    setBatch(reducedMotion ? [] : keys.slice(0, STAGGER_LIMIT))
  }, [reducedMotion])

  useEffect(() => {
    if (!batch?.length) return
    if (reducedMotion) {
      clock.stopAnimation()
      setBatch([])
      return
    }
    const animation = Animated.timing(clock, {
      toValue: STAGGER_ROW_MS + (batch.length - 1) * STAGGER_GAP_MS,
      duration: STAGGER_ROW_MS + (batch.length - 1) * STAGGER_GAP_MS,
      easing: Easing.linear,
      useNativeDriver: true,
    })
    animation.start()
    return () => { animation.stop() }
  }, [batch, clock, reducedMotion])

  const styleFor = useCallback((key: string, index: number) => {
    if (reducedMotion) return undefined
    // Reserve only the initial render batch until FlatList reports visibility.
    if (batch == null) return index < STAGGER_LIMIT ? { opacity: 0 } : undefined
    const window = staggerWindow(batch.indexOf(key))
    if (!window) return undefined
    const inputRange = [window.start, window.start + STAGGER_ROW_MS / 2, window.end]
    return {
      opacity: clock.interpolate({ inputRange, outputRange: [0, 0.875, 1], extrapolate: 'clamp' }),
      transform: [{ translateY: clock.interpolate({ inputRange, outputRange: [8, 1, 0], extrapolate: 'clamp' }) }],
    }
  }, [batch, clock, reducedMotion])
  return { reveal, styleFor }
}
