/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { Animated, BackHandler } from 'react-native'
import { Navigation } from 'react-native-navigation'
import { useSettingsTransition } from '@/components/common/SettingsPage'
import { useLuxTheme } from '@/theme/LuxTheme'
import { registerPageClose } from './pageTransitionRegistry'

/** Native screens below Home use the exact same clock and style as SettingsPage. */
export function SubpageScreen({ componentId, children }: { componentId: string, children: ReactNode }) {
  const { colors } = useLuxTheme()
  const { style, requestClose } = useSettingsTransition()
  const active = useRef(true)
  useLayoutEffect(() => {
    let pending: Promise<unknown> | undefined
    const close = async() => {
      pending ??= new Promise(resolve => {
        requestClose(() => { resolve(Navigation.pop(componentId)) })
      })
      return pending
    }
    const unregister = registerPageClose(componentId, close)
    // Layout registration precedes children's passive back listeners. Deeper tasks win.
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!active.current) return false
      void close()
      return true
    })
    const appear = Navigation.events().registerComponentDidAppearListener(event => {
      if (event.componentId === componentId) active.current = true
    })
    const disappear = Navigation.events().registerComponentDidDisappearListener(event => {
      if (event.componentId === componentId) active.current = false
    })
    return () => { unregister(); back.remove(); appear.remove(); disappear.remove() }
  }, [componentId, requestClose])
  return <Animated.View style={[{ flex: 1, backgroundColor: colors.bg.app }, style]}>{children}</Animated.View>
}
