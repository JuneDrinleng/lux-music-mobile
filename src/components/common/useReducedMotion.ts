/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { useEffect, useState } from 'react'
import { AccessibilityInfo } from 'react-native'

/** Until the system preference resolves, conservatively skip decoration. */
export const useReducedMotion = () => {
  const [reduced, setReduced] = useState(true)
  useEffect(() => {
    let active = true
    let eventReceived = false
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', value => {
      eventReceived = true
      if (active) setReduced(value)
    })
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (active && !eventReceived) setReduced(value)
    }).catch(() => {})
    return () => {
      active = false
      subscription.remove()
    }
  }, [])
  return reduced
}
