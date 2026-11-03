/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { forwardRef, useImperativeHandle, useRef } from 'react'
import { TextInput, type TextInputProps } from 'react-native'
import { useFocusVisibility } from './FocusVisibleScrollView'

/** Raw search fields keep their native API while participating in shared reveal. */
export const FocusVisibleInput = forwardRef<TextInput, TextInputProps>(({ onFocus, onBlur, ...props }, ref) => {
  const input = useRef<TextInput>(null)
  const visibility = useFocusVisibility()
  useImperativeHandle(ref, () => input.current!, [])
  return <TextInput {...props} ref={input}
    onFocus={event => { if (input.current) visibility?.focus(input.current); onFocus?.(event) }}
    onBlur={event => { if (input.current) visibility?.blur(input.current); onBlur?.(event) }}
  />
})
