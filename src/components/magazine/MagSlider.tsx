/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo, useEffect, useRef, useState } from 'react'
import { PanResponder, TouchableOpacity, View, type LayoutChangeEvent } from 'react-native'

import Text from '@/components/common/Text'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import {
  cacheStepRatio,
  cacheTickLabelLeft,
  clampUnit,
  indexForCacheStep,
  nearestCacheStepIndex,
  resolveCacheStepCommit,
} from '@/utils/cacheLimitSteps'
import { createStyle } from '@/utils/tools'

/**
 * Magazine slider (§4.12 + §10.2).
 * Tick x uses the same mapping as the thumb: cacheStepRatio(i,n)×trackWidth,
 * centered on that x, clamped only at track edges — never flex-cell spacing.
 */

export interface MagSliderProps {
  steps: readonly number[]
  value: number
  formatTick: (step: number) => string
  onCommit: (step: number) => void
  accessibilityLabel?: string
  formatValue?: (step: number) => string
}

const THUMB = 20

const useStyles = sharedLuxStyles((colors) => {
  const r = magazineRoles(colors)
  return createStyle({
    trackWrap: {
      height: 28,
      justifyContent: 'center',
    },
    track: {
      height: 2,
      borderRadius: 1,
      backgroundColor: r.hairline,
      justifyContent: 'center',
    },
    fill: {
      position: 'absolute',
      left: 0,
      height: 4,
      borderRadius: 2,
      backgroundColor: r.ink,
    },
    thumb: {
      position: 'absolute',
      width: THUMB,
      height: THUMB,
      borderRadius: THUMB / 2,
      backgroundColor: r.accent,
    },
    ticks: {
      position: 'relative',
      marginTop: 6,
      height: 16,
      width: '100%',
    },
    tickHit: {
      position: 'absolute',
      top: 0,
      height: 16,
      justifyContent: 'center',
    },
    tick: {
      fontWeight: '400',
      lineHeight: 13,
      fontVariant: ['tabular-nums'],
    },
    tickActive: {
      fontWeight: '700',
      lineHeight: 13,
      fontVariant: ['tabular-nums'],
    },
  })
})

export const MagSlider = memo(({
  steps,
  value,
  formatTick,
  onCommit,
  accessibilityLabel,
  formatValue,
}: MagSliderProps) => {
  const styles = useStyles()
  const { colors, mode } = useLuxTheme()
  const r = magazineRoles(colors)
  const widthRef = useRef(1)
  const stepsRef = useRef(steps)
  const valueRef = useRef(value)
  const onCommitRef = useRef(onCommit)
  const dragRef = useRef({ dragging: false, startRatio: 0, startDx: 0, ratio: 0 })
  const labelWidthsRef = useRef<Record<number, number>>({})
  stepsRef.current = steps
  valueRef.current = value
  onCommitRef.current = onCommit

  const restingIndex = indexForCacheStep(steps, value)
  const restingRatio = cacheStepRatio(restingIndex, steps.length)
  const [dragRatio, setDragRatio] = useState<number | null>(null)
  const [trackWidth, setTrackWidth] = useState(0)
  const [wrapHeight, setWrapHeight] = useState(0)
  const [labelWidths, setLabelWidths] = useState<Record<number, number>>({})
  const ratio = dragRatio ?? restingRatio
  const activeIndex = dragRatio == null ? restingIndex : nearestCacheStepIndex(dragRatio, steps.length)
  const displayStep = steps[activeIndex] ?? steps[0] ?? 0
  const valueLabel = formatValue?.(displayStep) ?? formatTick(displayStep)

  useEffect(() => {
    if (dragRef.current.dragging || dragRatio == null) return
    if (Math.abs(dragRatio - restingRatio) < 0.0001) setDragRatio(null)
  }, [dragRatio, restingRatio])

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponderCapture: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (event, gesture) => {
      const width = widthRef.current
      const next = clampUnit(width > 0 ? event.nativeEvent.locationX / width : 0)
      dragRef.current = { dragging: true, startRatio: next, startDx: gesture.dx, ratio: next }
      setDragRatio(next)
    },
    onPanResponderMove: (_event, gesture) => {
      const width = widthRef.current
      const next = clampUnit(width > 0
        ? dragRef.current.startRatio + (gesture.dx - dragRef.current.startDx) / width
        : 0)
      dragRef.current.ratio = next
      setDragRatio(next)
    },
    onPanResponderRelease: () => {
      const stepsNow = stepsRef.current
      const index = nearestCacheStepIndex(dragRef.current.ratio, stepsNow.length)
      const snapped = cacheStepRatio(index, stepsNow.length)
      dragRef.current.dragging = false
      dragRef.current.ratio = snapped
      setDragRatio(snapped)
      const next = resolveCacheStepCommit(stepsNow, snapped, valueRef.current)
      if (next != null) onCommitRef.current(next)
    },
    onPanResponderTerminate: () => {
      dragRef.current.dragging = false
      setDragRatio(null)
    },
  })).current

  const onTrackLayout = (event: LayoutChangeEvent) => {
    widthRef.current = event.nativeEvent.layout.width
    setTrackWidth(event.nativeEvent.layout.width)
    setWrapHeight(event.nativeEvent.layout.height)
  }

  const thumbLeft = trackWidth > 0 ? (ratio * trackWidth) - (THUMB / 2) : 0
  const thumbTop = wrapHeight > 0 ? (wrapHeight - THUMB) / 2 : 0
  const thumbBorder = mode === 'light'
    ? { borderWidth: 2, borderColor: r.ink }
    : { borderWidth: 2, borderColor: r.paper }

  const nudge = (direction: 1 | -1) => {
    const stepsNow = stepsRef.current
    const index = indexForCacheStep(stepsNow, valueRef.current)
    const next = stepsNow[index + direction]
    if (next == null || next === valueRef.current) return
    onCommitRef.current(next)
  }

  return (
    <View>
      <View
        style={styles.trackWrap}
        onLayout={onTrackLayout}
        pointerEvents="box-only"
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ text: valueLabel }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'increment') nudge(1)
          if (event.nativeEvent.actionName === 'decrement') nudge(-1)
        }}
        {...panResponder.panHandlers}
      >
        <View pointerEvents="none" style={styles.track}>
          <View style={[styles.fill, { width: `${ratio * 100}%`, top: -1 }]} />
        </View>
        <View
          pointerEvents="none"
          style={[styles.thumb, thumbBorder, { left: thumbLeft, top: thumbTop }]}
        />
      </View>
      <View style={styles.ticks}>
        {steps.map((step, index) => {
          const active = index === activeIndex
          const measured = labelWidths[index] ?? 0
          const left = trackWidth > 0
            ? cacheTickLabelLeft(index, steps.length, trackWidth, measured)
            : 0
          return (
            <TouchableOpacity
              key={`${step}-${index}`}
              style={[styles.tickHit, { left }]}
              activeOpacity={0.84}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => {
                if (step !== valueRef.current) onCommitRef.current(step)
              }}
            >
              <Text
                size={10}
                numberOfLines={1}
                color={active ? r.ink : r.muted}
                style={active ? styles.tickActive : styles.tick}
                onLayout={(event) => {
                  const w = event.nativeEvent.layout.width
                  if (!(w > 0) || labelWidthsRef.current[index] === w) return
                  labelWidthsRef.current[index] = w
                  setLabelWidths({ ...labelWidthsRef.current })
                }}
              >
                {formatTick(step)}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
})
