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
 * 刻度在轨道下按预览均分：第一档靠左，最后一档靠右，中间居中。
 * 拇指中心和填充宽度是档位 i/(n-1)。填色 `line.white`，描边 `accent.primary`。
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
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    paddingRight: 18,
    paddingBottom: 2,
    paddingLeft: 18,
  },
  titleLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
    minWidth: 0,
  },
  title: {
    marginBottom: 0,
    fontWeight: '700',
    lineHeight: 20,
  },
  chip: {
    height: 24,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: colors.accent.soft,
    paddingHorizontal: 10,
  },
  chipText: {
    fontWeight: '700',
    includeFontPadding: false,
  },
  trackPad: {
    paddingTop: 4,
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  trackWrap: {
    height: 28,
    justifyContent: 'center',
  },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line.divider,
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 2,
    backgroundColor: colors.accent.primary,
  },
  thumb: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2.5,
    backgroundColor: colors.line.white,
    borderColor: colors.accent.primary,
    shadowColor: colors.shadow.ink,
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  ticks: {
    flexDirection: 'row',
    marginTop: 6,
    paddingHorizontal: 2,
  },
  tickCell: {
    flex: 1,
    minWidth: 0,
  },
  tick: {
    fontWeight: '400',
    lineHeight: 13,
  },
  tickActive: {
    fontWeight: '700',
    lineHeight: 13,
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
  const [wrapHeight, setWrapHeight] = useState(0)
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
    setWrapHeight(event.nativeEvent.layout.height)
  }

  const onThumbLayout = (event: LayoutChangeEvent) => {
    const size = event.nativeEvent.layout.width
    if (size > 0) setThumbSize(size)
  }

  const thumbLeft = trackWidth > 0 ? (ratio * trackWidth) - (thumbSize / 2) : 0
  const thumbTop = wrapHeight > 0 ? (wrapHeight - thumbSize) / 2 : 0
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
      <View style={localStyles.titleRow}>
        <View style={localStyles.titleLeft}>
          <View style={[parentStyles.groupRowIconWrap, parentStyles.iconWrapPurple]}>
            <MdiIcon name={icon} size={24} color={colors.ink.icon} />
          </View>
          <View style={parentStyles.groupRowTextWrap}>
            <Text size={15} color={colors.ink.list} style={localStyles.title}>{title}</Text>
          </View>
        </View>
        <View style={localStyles.chip}>
          <Text size={12} color={colors.ink.chipActive} style={localStyles.chipText}>{chipLabel}</Text>
        </View>
      </View>
      <View style={localStyles.trackPad}>
        <View
          style={localStyles.trackWrap}
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
          <View pointerEvents="none" style={localStyles.track}>
            <View style={[localStyles.fill, { width: `${ratio * 100}%` }]} />
          </View>
          <View pointerEvents="none" onLayout={onThumbLayout} style={[localStyles.thumb, { left: thumbLeft, top: thumbTop }]} />
        </View>
        <View style={localStyles.ticks}>
          {steps.map((step, index) => {
            const active = index === activeIndex
            let textAlign: 'left' | 'center' | 'right' = 'center'
            if (index === 0) textAlign = 'left'
            else if (index === steps.length - 1) textAlign = 'right'
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
                  size={10}
                  numberOfLines={1}
                  color={active ? colors.ink.list : colors.ink.secondary}
                  style={[active ? localStyles.tickActive : localStyles.tick, { textAlign, width: '100%' }]}
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
