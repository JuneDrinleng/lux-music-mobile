/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { PanResponder, View } from 'react-native'
import { useDrag } from '@/utils/hooks'
import { createStyle } from '@/utils/tools'

interface Props {
  progress: number
  duration: number
  accentColor: string
  trackColor: string
  barHeight?: number
}

const clampProgress = (progress: number) => {
  if (!Number.isFinite(progress)) return 0
  if (progress <= 0) return 0
  if (progress >= 1) return 1
  return progress
}

export default memo(({ progress, duration, accentColor, trackColor, barHeight = 4 }: Props) => {
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

  return (
    <View style={styles.wrap}>
      <View style={[styles.track, { backgroundColor: trackColor, height: barHeight }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${visibleProgress * 100}%`,
              backgroundColor: accentColor,
            },
          ]}
        />
      </View>
      <View onLayout={onLayout} style={styles.touchArea} {...panResponder.panHandlers} />
    </View>
  )
})

const styles = createStyle({
  wrap: {
    position: 'relative',
    width: '100%',
  },
  track: {
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
  touchArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -10,
    bottom: -10,
    zIndex: 5,
  },
})
