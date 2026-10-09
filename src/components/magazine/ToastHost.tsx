/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo, useEffect, useRef, useState } from 'react'
import { Animated, StyleSheet, View } from 'react-native'

import { MagToast } from './Toast'
import { subscribeMagToast, type MagToastPayload } from './toastBus'

export type { MagToastPayload, MagToastTone } from './toastBus'
export { showMagToast } from './toastBus'

export const MagToastHost = memo(() => {
  const [payload, setPayload] = useState<MagToastPayload | null>(null)
  const opacity = useRef(new Animated.Value(0)).current
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return subscribeMagToast((next) => {
      if (hideTimer.current) clearTimeout(hideTimer.current)
      setPayload(next)
      opacity.setValue(0)
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start()
      const durationMs = next.durationMs ?? 2200
      hideTimer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
          setPayload(null)
        })
      }, durationMs)
    })
  }, [opacity])

  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
  }, [])

  if (!payload) return null

  return (
    <View pointerEvents="none" style={styles.host}>
      <Animated.View style={{ opacity }}>
        <MagToast
          message={payload.message}
          tone={payload.tone}
          icon={payload.icon ?? (payload.tone === 'danger' ? 'alert-circle-outline' : 'check-circle-outline')}
        />
      </Animated.View>
    </View>
  )
})

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 140,
    alignItems: 'center',
    zIndex: 90,
    elevation: 40,
  },
})
