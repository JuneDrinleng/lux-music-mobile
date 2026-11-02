/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Animated, Easing, NativeModules } from 'react-native'

// RN 0.73 Android Modal slide: catalyst_slide_up/down.xml use config_shortAnimTime
// and the default AccelerateDecelerateInterpolator. Read the device resource rather
// than choosing a JS duration. This also lets exit finish before React unmounts it.
const modalEasing = (value: number) => Math.cos((value + 1) * Math.PI) / 2 + 0.5

/** #162 bottom-popup lifecycle, shared by the persistent player and original Modal pages. */
export const useBottomPopupTransition = (height: number, kind: 'player' | 'modal', autoOpen = false) => {
  const progress = useRef(new Animated.Value(0)).current
  const phase = useRef<'hidden' | 'opening' | 'open' | 'closing'>('hidden')
  const generation = useRef(0)
  const duration: number = kind === 'modal' ? NativeModules.UtilsModule.modalSlideDuration : 0

  const requestClose = useCallback((onClosed?: () => void) => {
    if (phase.current === 'hidden' || phase.current === 'closing') return
    phase.current = 'closing'
    const current = ++generation.current
    progress.stopAnimation()
    Animated.timing(progress, {
      toValue: 0,
      duration: kind === 'player' ? 300 : duration,
      easing: kind === 'player' ? Easing.out(Easing.cubic) : modalEasing,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished || generation.current !== current) return
      phase.current = 'hidden'
      onClosed?.()
    })
  }, [progress, kind, duration])

  const requestOpen = useCallback((onStart?: (wasHidden: boolean) => void) => {
    if (phase.current === 'opening' || phase.current === 'open') return
    const wasHidden = phase.current === 'hidden'
    phase.current = 'opening'
    const current = ++generation.current
    onStart?.(wasHidden)
    progress.stopAnimation()
    if (wasHidden) progress.setValue(0)
    Animated.timing(progress, {
      toValue: 1,
      duration: kind === 'player' ? 420 : duration,
      easing: kind === 'player' ? Easing.out(Easing.back(1.05)) : modalEasing,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && generation.current === current) phase.current = 'open'
    })
  }, [progress, kind, duration])

  const cancel = useCallback(() => { ++generation.current; progress.stopAnimation() }, [progress])
  useEffect(() => {
    if (autoOpen) requestOpen()
    return cancel
  }, [autoOpen, cancel, requestOpen])

  const style = useMemo(() => ({
    transform: [{
      translateY: progress.interpolate({
        inputRange: [0, 1], outputRange: [height, 0], extrapolate: 'clamp',
      }),
    }],
  }), [progress, height])
  // Original opaque RN Modal dims the underlying window by 0.5; no content fade.
  const backdropOpacity = useMemo(() => progress.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] }), [progress])
  return { style, progress, phase, requestOpen, requestClose, backdropOpacity }
}
