/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { PanResponder, View } from 'react-native'
import { useDrag } from '@/utils/hooks'
import { createStyle } from '@/utils/tools'
import { useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'

interface Props {
  progress: number
  duration: number
  /** @deprecated Magazine seek uses ink fill + accent thumb; kept for call-site compat. */
  accentColor?: string
  /** @deprecated */
  trackColor?: string
  barHeight?: number
}

const THUMB = 14
const TRACK_H = 2
const FILL_H = 4

const clampProgress = (progress: number) => {
  if (!Number.isFinite(progress)) return 0
  if (progress <= 0) return 0
  if (progress >= 1) return 1
  return progress
}

export default memo(({ progress, duration }: Props) => {
  const { colors, mode } = useLuxTheme()
  const r = magazineRoles(colors)
  const [draging, setDraging] = useState(false)
  const [dragProgress, setDragProgress] = useState(0)
  const durationRef = useRef(duration)

  useEffect(() => {
    durationRef.current = duration
  }, [duration])

  const onSetProgress = useCallback((nextProgress: number) => {
    if (!durationRef.current || durationRef.current <= 0) return
    global.app_event.setProgress(clampProgress(nextProgress) * durationRef.current)
  }, [])

  const {
    onLayout,
    onDragStart,
    onDragEnd,
    onDrag,
  } = useDrag(onSetProgress, setDraging, setDragProgress)

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: (evt, gestureState) => {
        onDragStart(gestureState.dx, evt.nativeEvent.locationX)
      },
      onPanResponderMove: (evt, gestureState) => {
        onDrag(gestureState.dx)
      },
      onPanResponderRelease: () => {
        onDragEnd()
      },
      onPanResponderTerminate: () => {
        onDragEnd()
      },
    }),
  ).current

  const visibleProgress = clampProgress(draging ? dragProgress : progress)
  const thumbLeft = `${visibleProgress * 100}%`

  return (
    <View style={styles.wrap}>
      <View style={[styles.track, { backgroundColor: r.hairline, height: TRACK_H }]} />
      <View
        style={[
          styles.fill,
          {
            width: thumbLeft as `${number}%`,
            backgroundColor: r.ink,
            height: FILL_H,
            marginTop: -(FILL_H - TRACK_H) / 2,
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.thumb,
          {
            left: thumbLeft as `${number}%`,
            backgroundColor: r.accent,
            borderColor: mode === 'dark' ? r.paper : r.ink,
            marginLeft: -THUMB / 2,
          },
        ]}
      />
      <View onLayout={onLayout} style={styles.touchArea} {...panResponder.panHandlers} />
    </View>
  )
})

const styles = createStyle({
  wrap: {
    position: 'relative',
    width: '100%',
    height: 44,
    justifyContent: 'center',
  },
  track: {
    borderRadius: 999,
    width: '100%',
  },
  fill: {
    position: 'absolute',
    left: 0,
    borderRadius: 999,
  },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: 2,
    top: (44 - THUMB) / 2,
  },
  touchArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 5,
  },
})
