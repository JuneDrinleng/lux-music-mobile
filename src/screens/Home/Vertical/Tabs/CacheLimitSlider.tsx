/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

// Lux Proprietary

import { memo, useEffect, useRef, useState } from 'react'
import { PanResponder, TouchableOpacity, View, type LayoutChangeEvent } from 'react-native'

import Text from '@/components/common/Text'
import { MdiIcon } from '@/components/common/MdiIcon'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import {
  cacheStepRatio,
  cacheTickAlign,
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
 * 刻度按档位落在轨道下：两端贴齐轨道，中间档中心对准拇指。拇指填色是 `line.white`，描边是 `accent.primary`。
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
  titleRow: {
    minHeight: 0,
    paddingTop: 10,
    paddingBottom: 0,
  },
  title: {
    marginBottom: 0,
  },
  chip: {
    flexShrink: 0,
    alignSelf: 'center',
    borderRadius: 999,
    backgroundColor: colors.accent.soft,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  chipText: {
    fontWeight: '700',
  },
  trackPad: {
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 10,
  },
  touch: {
    height: 24,
    justifyContent: 'center',
  },
  lane: {
    height: 24,
    justifyContent: 'center',
  },
  track: {
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: colors.surface.playerTrack,
  },
  fill: {
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.accent.primary,
  },
  thumb: {
    position: 'absolute',
    top: 0,
    width: 24,
    height: 24,
    borderRadius: 999,
    borderWidth: 3,
    backgroundColor: colors.line.white,
    borderColor: colors.accent.primary,
  },
  ticks: {
    height: 28,
    marginTop: 6,
  },
  tickHit: {
    position: 'absolute',
    top: 0,
    height: 28,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  tickStart: {
    left: 0,
  },
  tickEnd: {
    right: 0,
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
  const [thumbSize, setThumbSize] = useState(24)
  const [labelWidths, setLabelWidths] = useState<Readonly<Record<number, number>>>({})
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
      <View style={[parentStyles.optionDetailRow, localStyles.titleRow]}>
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
      <View style={localStyles.trackPad}>
        <View
          style={localStyles.touch}
          onLayout={onTrackLayout}
          pointerEvents="box-only"
          hitSlop={{ top: 10, bottom: 8, left: 4, right: 4 }}
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
          <View pointerEvents="none" style={localStyles.lane}>
            <View style={localStyles.track}>
              <View style={[localStyles.fill, { width: `${ratio * 100}%` }]} />
            </View>
            <View onLayout={onThumbLayout} style={[localStyles.thumb, { left: thumbLeft }]} />
          </View>
        </View>
        <View style={localStyles.ticks}>
          {steps.map((step, index) => {
            const active = index === activeIndex
            const align = cacheTickAlign(index, steps.length)
            let textAlign: 'left' | 'center' | 'right' = 'center'
            if (align === 'start') textAlign = 'left'
            else if (align === 'end') textAlign = 'right'
            const measured = labelWidths[step]
            const centered = align !== 'center'
              ? null
              : {
                  left: `${cacheStepRatio(index, steps.length) * 100}%` as const,
                  marginLeft: measured == null ? 0 : -measured / 2,
                  opacity: measured == null ? 0 : 1,
                }
            const slotStyle = align === 'end'
              ? localStyles.tickEnd
              : centered ?? localStyles.tickStart
            return (
              <TouchableOpacity
                key={step}
                style={[localStyles.tickHit, slotStyle]}
                activeOpacity={0.84}
                hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onLayout={(event) => {
                  const width = Math.round(event.nativeEvent.layout.width)
                  if (width <= 0) return
                  setLabelWidths(prev => {
                    if (prev[step] === width) return prev
                    return { ...prev, [step]: width }
                  })
                }}
                onPress={() => {
                  if (step !== valueRef.current) onCommitRef.current(step)
                }}
              >
                <Text
                  size={11}
                  numberOfLines={1}
                  color={active ? colors.ink.list : colors.ink.quiet}
                  style={[active ? localStyles.tickActive : localStyles.tick, { textAlign }]}
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
