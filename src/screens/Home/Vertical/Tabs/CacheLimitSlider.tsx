/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

// Lux Proprietary

import { memo, useEffect, useRef, useState } from 'react'
import { PanResponder, TouchableOpacity, View, type LayoutChangeEvent } from 'react-native'

import Text from '@/components/common/Text'
import { MdiIcon } from '@/components/common/MdiIcon'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import {
  cacheStepRatio,
  clampUnit,
  indexForCacheStep,
  nearestCacheStepIndex,
  resolveCacheStepCommit,
} from '@/utils/cacheLimitSteps'
import { createStyle } from '@/utils/tools'

/**
 * 缓存上限滑条。
 *
 * `@react-native-community/slider` 的拇指只有 `thumbTintColor`，画不出浅色底加强调色描边。
 * 它的 JS 包装层还会把数值 0 当成空值丢掉，而音频上限的 0 就是「关闭」。
 * 这里用 PanResponder：拖动时拇指连续移动，刻度和胶囊只吸附到既有档位；松手才 `onCommit`。
 */

interface CacheLimitSliderProps {
  styles: Record<string, any>
  icon: string
  title: string
  steps: readonly number[]
  value: number
  formatTick: (step: number) => string
  formatChip: (step: number) => string
  onCommit: (step: number) => void
}

const useCacheLimitStyles = sharedLuxStyles(colors => createStyle({
  title: {
    marginBottom: 0,
  },
  chip: {
    flexShrink: 0,
    borderRadius: 999,
    backgroundColor: colors.accent.soft,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: {
    fontWeight: '700',
  },
  sliderBlock: {
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  touch: {
    height: 40,
    justifyContent: 'center',
  },
  thumbLane: {
    height: 22,
    justifyContent: 'center',
  },
  track: {
    height: 4,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: colors.surface.playerTrack,
  },
  fill: {
    height: 4,
    backgroundColor: colors.accent.primary,
  },
  thumb: {
    position: 'absolute',
    top: 0,
    width: 22,
    height: 22,
    borderRadius: 999,
    borderWidth: 3,
    backgroundColor: colors.bg.plain,
    borderColor: colors.accent.primary,
  },
  ticks: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 2,
  },
  tickCell: {
    flex: 1,
    paddingVertical: 4,
  },
  tick: {
    fontWeight: '400',
  },
  tickActive: {
    fontWeight: '700',
  },
}))

export const CacheLimitSlider = memo(({
  styles: parentStyles,
  icon,
  title,
  steps,
  value,
  formatTick,
  formatChip,
  onCommit,
}: CacheLimitSliderProps) => {
  const { colors } = useLuxTheme()
  const localStyles = useCacheLimitStyles()
  const widthRef = useRef(1)
  const stepsRef = useRef(steps)
  const valueRef = useRef(value)
  const onCommitRef = useRef(onCommit)
  const dragRef = useRef({ dragging: false, startRatio: 0, startDx: 0, ratio: 0 })
  stepsRef.current = steps
  valueRef.current = value
  onCommitRef.current = onCommit

  const restingIndex = indexForCacheStep(steps, value)
  const restingRatio = cacheStepRatio(restingIndex, steps.length)
  const [dragRatio, setDragRatio] = useState<number | null>(null)
  const [trackWidth, setTrackWidth] = useState(0)
  const [thumbSize, setThumbSize] = useState(22)
  const ratio = dragRatio ?? restingRatio
  const activeIndex = dragRatio == null ? restingIndex : nearestCacheStepIndex(dragRatio, steps.length)
  const displayStep = steps[activeIndex] ?? steps[0] ?? 0

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
  }

  const onThumbLayout = (event: LayoutChangeEvent) => {
    const size = event.nativeEvent.layout.width
    if (size > 0) setThumbSize(size)
  }

  const thumbLeft = trackWidth > 0 ? (ratio * trackWidth) - (thumbSize / 2) : 0
  const chipLabel = formatChip(displayStep)

  const nudge = (direction: 1 | -1) => {
    const stepsNow = stepsRef.current
    const index = indexForCacheStep(stepsNow, valueRef.current)
    const next = stepsNow[index + direction]
    if (next == null || next === valueRef.current) return
    onCommitRef.current(next)
  }

  return (
    <>
      <View style={parentStyles.optionDetailRow}>
        <View style={parentStyles.groupRowLeft}>
          <View style={[parentStyles.groupRowIconWrap, parentStyles.iconWrapPurple]}>
            <MdiIcon name={icon} size={24} color={colors.ink.icon} />
          </View>
          <View style={parentStyles.groupRowTextWrap}>
            <Text size={15} color={colors.ink.list} style={[parentStyles.groupRowTitle, localStyles.title]}>{title}</Text>
          </View>
        </View>
        <View style={localStyles.chip}>
          <Text size={12} color={colors.ink.pill} style={localStyles.chipText}>{chipLabel}</Text>
        </View>
      </View>
      <View style={localStyles.sliderBlock}>
        <View
          style={localStyles.touch}
          onLayout={onTrackLayout}
          pointerEvents="box-only"
          accessibilityRole="adjustable"
          accessibilityLabel={title}
          accessibilityValue={{ text: chipLabel }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'increment') nudge(1)
            if (event.nativeEvent.actionName === 'decrement') nudge(-1)
          }}
          {...panResponder.panHandlers}
        >
          <View pointerEvents="none" style={localStyles.thumbLane}>
            <View style={localStyles.track}>
              <View style={[localStyles.fill, { width: `${ratio * 100}%` }]} />
            </View>
            <View onLayout={onThumbLayout} style={[localStyles.thumb, { left: thumbLeft }]} />
          </View>
        </View>
        <View style={localStyles.ticks}>
          {steps.map((step, index) => {
            const active = index === activeIndex
            let align: 'left' | 'center' | 'right' = 'center'
            if (index === 0) align = 'left'
            else if (index === steps.length - 1) align = 'right'
            return (
              <TouchableOpacity
                key={step}
                style={localStyles.tickCell}
                activeOpacity={0.84}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  if (step !== valueRef.current) onCommitRef.current(step)
                }}
              >
                <Text
                  size={11}
                  numberOfLines={1}
                  color={active ? colors.ink.list : colors.ink.quiet}
                  style={[active ? localStyles.tickActive : localStyles.tick, { textAlign: align }]}
                >
                  {formatTick(step)}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </View>
    </>
  )
})
