import { useEffect, useRef } from 'react'
import { BackHandler } from 'react-native'

/** Preserve mount-order priority: a rerendering parent must not outrank its child. */
export function useBackHandler(handler: () => boolean) {
  const latest = useRef(handler)
  latest.current = handler
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => latest.current())
    return () => { subscription.remove() }
  }, [])
}
