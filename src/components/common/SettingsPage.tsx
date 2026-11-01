/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { createContext, useContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Animated, StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native'
import { APP_LAYER_INDEX } from '@/config/constant'
import commonState from '@/store/common/state'
import { useLuxTheme } from '@/theme/LuxTheme'
import { isHomeScreenActive } from '@/utils/homeBackHandler'
import { useBackHandler } from '@/utils/hooks/useBackHandler'
import { VisibleDockHeightContext, useVisibleDockHeight } from './VisibleDockHeight'
import { useOverlaySlideTransition } from './overlaySlideTransition'

/** Settings always uses the majority's right-entry curve in BOTH directions. */
export const useSettingsTransition = (autoOpen = true) => {
  const { width } = useWindowDimensions()
  return useOverlaySlideTransition(width, { symmetric: true, autoOpen })
}

const SubpageActiveContext = createContext(true)
export const useSubpageActive = () => useContext(SubpageActiveContext)

/** Stable listener: parent rerenders must not take priority over deeper pages. */
export const useSettingsBack = (handler: () => void, enabled = true) => {
  const active = useSubpageActive()
  const latest = useRef(handler)
  latest.current = handler
  useBackHandler(useCallback(() => {
    if (!active || !enabled || !isHomeScreenActive(commonState.componentIds)) return false
    latest.current()
    return true
  }, [active, enabled]))
}

/** Local sub-pages keep their outgoing content until the reverse animation ends. */
export const useSettingsSubpage = <T,>(root: T, enabled = true, initial = root) => {
  const [pages, updatePages] = useState<T[]>(enabled && !Object.is(initial, root) ? [root, initial] : [initial])
  const page = pages[pages.length - 1]
  const currentPages = useRef(pages)
  currentPages.current = pages
  const transition = useSettingsTransition(false)
  const { progress, requestClose, requestOpen } = transition
  useEffect(() => { progress.setValue(1) }, [progress])
  const setPage = useCallback((next: T, onChanged?: () => void) => {
    const stack = currentPages.current
    if (Object.is(next, stack[stack.length - 1])) return
    const commit = (nextPages: T[]) => { currentPages.current = nextPages; updatePages(nextPages) }
    if (!enabled) { commit([next]); onChanged?.(); return }
    const previous = stack.findIndex(value => Object.is(value, next))
    if (previous >= 0) {
      requestClose(() => { commit(stack.slice(0, previous + 1)); progress.setValue(1); onChanged?.() })
    } else {
      commit([...stack, next])
      requestOpen(onChanged)
    }
  }, [progress, requestClose, requestOpen, enabled])
  return { page, pages, setPage, style: transition.style }
}

/** Keep every ancestor mounted and painted; animate only the top child scene.
 * Stable depth keys preserve native scroll/input instances through push and pop.
 * The caller removes the outgoing scene only in requestClose's finished callback.
 */
export function SettingsSubpage<T>({ pages, style, children }: {
  pages: readonly T[]
  style: StyleProp<ViewStyle>
  children: (page: T) => ReactNode
}) {
  const { colors } = useLuxTheme()
  const parentActive = useSubpageActive()
  return <View style={{ flex: 1, backgroundColor: colors.bg.app, overflow: 'hidden' }}>
    {pages.map((page, index) => {
      const active = parentActive && index === pages.length - 1
      return <Animated.View key={index} collapsable={false}
        pointerEvents={active ? 'auto' : 'none'}
        accessibilityElementsHidden={!active} importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
        style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.bg.app }, active && index > 0 ? style : null]}>
        <SubpageActiveContext.Provider value={active}>{children(page)}</SubpageActiveContext.Provider>
      </Animated.View>
    })}
  </View>
}

/**
 * Persistent host for a Settings page at any depth below a Tab. Do not conditionally mount it:
 * it retains the last children through exit, then releases requests/listeners.
 * Children must use the supplied back callback; sub-page back uses the same helper.
 * The host is clipped above Dock so neither rendering nor hit testing covers it.
 */
export function SettingsPage({ visible, onBack, children, bottomInset = 0, hardwareBack = true }: {
  visible: boolean
  onBack: () => void
  children: (back: () => void) => ReactNode
  bottomInset?: number
  hardwareBack?: boolean
}) {
  const { colors } = useLuxTheme()
  const visibleDockHeight = useVisibleDockHeight(bottomInset)
  const { style, requestClose, requestOpen } = useSettingsTransition(false)
  const [retained, setRetained] = useState(visible)
  const lastChildren = useRef<ReactNode>(null)
  const latestBack = useRef(onBack)
  latestBack.current = onBack
  const back = useCallback(() => {
    requestClose(() => {
      setRetained(false)
      latestBack.current()
    })
  }, [requestClose])
  useSettingsBack(back, hardwareBack && visible)
  useEffect(() => {
    if (visible) {
      setRetained(true)
      requestOpen()
    } else {
      requestClose(() => { setRetained(false) })
    }
  }, [visible, requestClose, requestOpen])
  if (visible) lastChildren.current = children(back)
  if (!visible && !retained) {
    lastChildren.current = null
    return null
  }
  return <Animated.View pointerEvents={visible ? 'auto' : 'none'} style={[
    StyleSheet.absoluteFillObject,
    { bottom: visibleDockHeight, backgroundColor: colors.bg.app, overflow: 'hidden', zIndex: APP_LAYER_INDEX.controls + 5, elevation: APP_LAYER_INDEX.controls + 5 },
    style,
  ]}><VisibleDockHeightContext.Provider value={0}>{lastChildren.current}</VisibleDockHeightContext.Provider></Animated.View>
}
