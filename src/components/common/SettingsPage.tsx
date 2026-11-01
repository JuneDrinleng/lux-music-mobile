/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Animated, StyleSheet, useWindowDimensions } from 'react-native'
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

/** Stable listener: parent rerenders must not take priority over deeper pages. */
export const useSettingsBack = (handler: () => void, enabled = true) => {
  const latest = useRef(handler)
  latest.current = handler
  useBackHandler(useCallback(() => {
    if (!enabled || !isHomeScreenActive(commonState.componentIds)) return false
    latest.current()
    return true
  }, [enabled]))
}

/** Local sub-pages keep their outgoing content until the reverse animation ends. */
export const useSettingsSubpage = <T,>(root: T, enabled = true, initial = root) => {
  const [page, updatePage] = useState(initial)
  const currentPage = useRef(page)
  currentPage.current = page
  const transition = useSettingsTransition(false)
  const { progress, requestClose, requestOpen } = transition
  useEffect(() => { progress.setValue(1) }, [progress])
  const setPage = useCallback((next: T) => {
    if (Object.is(next, currentPage.current)) return
    if (!enabled) { updatePage(next); return }
    if (next === root) {
      requestClose(() => { updatePage(next); progress.setValue(1) })
    } else {
      updatePage(next)
      requestOpen()
    }
  }, [progress, requestClose, requestOpen, root, enabled])
  return { page, setPage, style: transition.style }
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
