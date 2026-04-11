/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

import { useTheme } from '@/store/theme/hook'
import { useMemo, useRef, useImperativeHandle, forwardRef } from 'react'
import { Pressable, type PressableProps, StyleSheet, type View, type ViewProps } from 'react-native'
// import { AppColors } from '@/theme'


export interface BtnProps extends PressableProps {
  ripple?: PressableProps['android_ripple'] | false
  style?: ViewProps['style']
  onChangeText?: (value: string) => void
  onClearText?: () => void
  children: React.ReactNode
}


export interface BtnType {
  measure: (callback: (x: number, y: number, width: number, height: number, pageX: number, pageY: number) => void) => void
}

export default forwardRef<BtnType, BtnProps>(({ ripple: propsRipple = {}, disabled, children, style, ...props }, ref) => {
  const theme = useTheme()
  const btnRef = useRef<View>(null)
  const ripple = useMemo(() => {
    if (propsRipple === false) return undefined
    return {
      color: theme['c-border-background'],
      ...propsRipple,
    }
  }, [theme, propsRipple])

  useImperativeHandle(ref, () => ({
    measure(callback) {
      btnRef.current?.measure(callback)
    },
  }))

  return (
    <Pressable
      android_ripple={ripple}
      disabled={disabled}
      style={StyleSheet.compose({ opacity: disabled ? 0.3 : 1 }, style)}
      {...props}
      ref={btnRef}
    >
      {children}
    </Pressable>
  )
})

