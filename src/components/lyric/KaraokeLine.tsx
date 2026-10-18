/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo, useEffect, useRef, useState } from 'react'
import { View, type StyleProp, type TextStyle } from 'react-native'
import Text from '@/components/common/Text'
import { type Line, getLyricClockOffset } from '@/plugins/lyric'
import { wordFill } from '@/plugins/lyricWords'
import { useIsPlay } from '@/store/player/hook'
import playerState from '@/store/player/state'
import { useSettingValue } from '@/store/setting/hook'
import { useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'

/** One native text pair + a single clip for unwrapped lines; source-word boxes for wraps.
 * Hidden native Text nodes measure variable-width words once. Only clip widths change
 * in the frame loop: no React updates, new views, or text measurements per frame.
 */
export default memo(({ line, size, style, active, singleLine = false }: {
  line: Line
  size: number
  style?: StyleProp<TextStyle>
  active: boolean
  singleLine?: boolean
}) => {
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const isPlay = useIsPlay()
  const rate = useSettingValue('player.playbackRate')
  const clips = useRef<Array<View | null>>([])
  const copies = useRef<Array<View | null>>([])
  const widths = useRef<number[]>([])
  const previous = useRef<number[]>([])
  const repaint = useRef<(() => void) | null>(null)
  const [wrapped, setWrapped] = useState(false)
  const wholeLine = singleLine || !wrapped
  const words = line.words

  useEffect(() => {
    if (!active || !words?.length) return
    let frame: number | undefined
    let position = playerState.progress.nowPlayTime * 1000
    let anchoredAt = performance.now()
    const update = (progress: typeof playerState.progress) => {
      position = progress.nowPlayTime * 1000
      anchoredAt = performance.now()
      paint()
    }
    const paint = () => {
      const now = position + (isPlay ? (performance.now() - anchoredAt) * rate : 0) + getLyricClockOffset() * rate
      const fills = wholeLine
        ? [words.reduce((width, word, index) => width + (widths.current[index] ?? 0) * wordFill(word, now), 0)]
        : words.map((word, index) => (widths.current[index] ?? 0) * wordFill(word, now))
      fills.forEach((width, index) => {
        if (previous.current[index] === width) return
        previous.current[index] = width
        clips.current[index]?.setNativeProps({ style: { width } })
      })
    }
    const tick = () => { paint(); frame = requestAnimationFrame(tick) }
    repaint.current = paint
    previous.current = []
    paint()
    if (isPlay) frame = requestAnimationFrame(tick)
    global.state_event.on('playProgressChanged', update)
    return () => {
      repaint.current = null
      if (frame !== undefined) cancelAnimationFrame(frame)
      global.state_event.off('playProgressChanged', update)
    }
  }, [active, isPlay, line, rate, wholeLine, words])

  if (!words?.length) return <Text size={size} color={r.display} style={style} numberOfLines={singleLine ? 1 : undefined}>{line.text}</Text>
  if (wholeLine) {
    return (
      <View accessible accessibilityLabel={line.text} onLayout={({ nativeEvent }) => {
        copies.current[0]?.setNativeProps({ style: { width: nativeEvent.layout.width } })
        repaint.current?.()
      }}>
        <Text size={size} color={r.faint} style={style} numberOfLines={singleLine ? 1 : undefined} onTextLayout={({ nativeEvent }) => {
          if (!singleLine && nativeEvent.lines.length > 1) setWrapped(true)
        }}>{line.text}</Text>
        <View ref={node => { clips.current[0] = node }} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 0, overflow: 'hidden' }}>
          <View collapsable={false} ref={node => { copies.current[0] = node }}><Text size={size} color={r.display} style={style} numberOfLines={singleLine ? 1 : undefined}>{line.text}</Text></View>
        </View>
        <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', top: 0, left: 0, flexDirection: 'row', opacity: 0 }}>
          {words.map((word, index) => <Text key={index} size={size} style={[style, { flexShrink: 0 }]} onLayout={({ nativeEvent }) => {
            widths.current[index] = nativeEvent.layout.width
            previous.current[0] = -1
            repaint.current?.()
          }}>{word.text}</Text>)}
        </View>
      </View>
    )
  }
  return (
    <View accessible accessibilityLabel={line.text} style={{ flexDirection: 'row', flexWrap: singleLine ? 'nowrap' : 'wrap', overflow: 'hidden' }}>
      {words.map((word, index) => (
        <View key={index} accessible={false} style={{ flexShrink: 0, maxWidth: '100%' }} onLayout={({ nativeEvent }) => {
          widths.current[index] = nativeEvent.layout.width
          copies.current[index]?.setNativeProps({ style: { width: nativeEvent.layout.width } })
          previous.current[index] = -1
          repaint.current?.()
        }}>
          <Text size={size} color={r.faint} style={style}>{word.text}</Text>
          <View ref={node => { clips.current[index] = node }} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 0, overflow: 'hidden' }}>
            <View collapsable={false} ref={node => { copies.current[index] = node }}><Text size={size} color={r.display} style={style}>{word.text}</Text></View>
          </View>
        </View>
      ))}
    </View>
  )
})
