/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react'
import { Keyboard, ScrollView, View, type ScrollViewProps, type TextInput, type ViewProps } from 'react-native'
import { focusScrollOffset } from './dockLayoutMath'

interface FocusVisibility {
  focus: (input: TextInput) => void
  blur: (input: TextInput) => void
  action: (view: View | null) => void
  refresh: () => void
}
const FocusVisibilityContext = createContext<FocusVisibility | null>(null)
export const useFocusVisibility = () => useContext(FocusVisibilityContext)

/** Measures the resized viewport; never subtracts IME height again on Android. */
export function FocusVisibleScrollView({ onLayout, onScroll, onContentSizeChange, ...props }: ScrollViewProps) {
  const viewport = useRef<View>(null)
  const scroll = useRef<ScrollView>(null)
  const input = useRef<TextInput | null>(null)
  const action = useRef<View | null>(null)
  const offset = useRef(0)
  const contentHeight = useRef(0)
  const frame = useRef<number | null>(null)
  const generation = useRef(0)
  const mounted = useRef(true)
  const refresh = useCallback(() => {
    if (frame.current != null) cancelAnimationFrame(frame.current)
    const token = ++generation.current
    // Focus may precede resize/Dock layout. Layout and didShow run this again.
    frame.current = requestAnimationFrame(() => {
      frame.current = null
      const focused = input.current
      const host = scroll.current
      if (!focused?.isFocused() || !host || !viewport.current) return
      viewport.current.measureInWindow((_x, viewportY, _w, viewportHeight) => {
        focused.measureInWindow((_ix, inputY, _iw, inputHeight) => {
          const apply = (actionBottom?: number) => {
            if (!mounted.current || token !== generation.current || input.current !== focused || !focused.isFocused()) return
            const y = focusScrollOffset(offset.current, viewportHeight, contentHeight.current, inputY - viewportY, inputY + inputHeight - viewportY, actionBottom)
            if (Math.abs(y - offset.current) > 1) host.scrollTo({ y, animated: false })
          }
          if (action.current) action.current.measureInWindow((_ax, y, _aw, h) => { apply(y + h - viewportY) })
          else apply()
        })
      })
    })
  }, [])
  const value = useMemo<FocusVisibility>(() => ({
    focus: node => { input.current = node; refresh() },
    blur: node => { if (input.current === node) { input.current = null; generation.current++ } },
    action: node => { action.current = node },
    refresh,
  }), [refresh])
  useEffect(() => {
    mounted.current = true
    const shown = Keyboard.addListener('keyboardDidShow', refresh)
    return () => {
      shown.remove()
      mounted.current = false
      if (frame.current != null) cancelAnimationFrame(frame.current)
    }
  }, [refresh])
  return <View ref={viewport} collapsable={false} style={{ flex: 1 }} onLayout={refresh}>
    <FocusVisibilityContext.Provider value={value}>
      <ScrollView {...props} ref={scroll} keyboardShouldPersistTaps={props.keyboardShouldPersistTaps ?? 'handled'} scrollEventThrottle={16}
        onLayout={event => { onLayout?.(event); refresh() }}
        onContentSizeChange={(w, h) => { contentHeight.current = h; onContentSizeChange?.(w, h); refresh() }}
        onScroll={event => { offset.current = event.nativeEvent.contentOffset.y; onScroll?.(event) }}
      />
    </FocusVisibilityContext.Provider>
  </View>
}

/** Mark a primary action inside the scroll content to include it in focus reveal. */
export function FocusVisibleAction(props: ViewProps) {
  const visibility = useFocusVisibility()
  return <View {...props} collapsable={false} ref={visibility?.action} onLayout={event => { props.onLayout?.(event); visibility?.refresh() }} />
}
