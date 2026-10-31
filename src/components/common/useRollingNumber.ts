/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { useEffect, useRef, useState } from 'react'
import { Animated, Easing } from 'react-native'
import { COUNT_ROLL_MS, interpolateCount } from './asyncAppearMath'

/** null means unknown; refreshes retain the last value rather than resetting. */
export const useRollingNumber = (target: number | null, reducedMotion: boolean) => {
  const progress = useRef(new Animated.Value(0)).current
  const current = useRef(0)
  const [displayed, setDisplayed] = useState<number | null>(null)
  useEffect(() => {
    if (target == null) return
    if (reducedMotion || current.current == target) {
      current.current = target
      setDisplayed(target)
      return
    }
    const from = current.current
    progress.setValue(0)
    setDisplayed(from)
    const listener = progress.addListener(({ value }) => {
      const next = interpolateCount(from, target, value)
      current.current = next
      setDisplayed(next)
    })
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: COUNT_ROLL_MS,
      easing: Easing.linear, // Cubic ease-out is applied by interpolateCount.
      useNativeDriver: false, // Text content cannot use the native driver.
    })
    animation.start(({ finished }) => {
      if (finished) {
        current.current = target
        setDisplayed(target)
      }
    })
    return () => {
      animation.stop()
      progress.removeListener(listener)
    }
  }, [progress, reducedMotion, target])
  return target == null ? null : reducedMotion ? target : displayed ?? 0
}
