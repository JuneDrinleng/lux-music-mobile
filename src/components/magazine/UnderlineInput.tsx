/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo, useRef, useState } from 'react'
import { TextInput, View, type TextInputProps } from 'react-native'

import Text from '@/components/common/Text'
import { useFocusVisibility } from '@/components/common/FocusVisibleScrollView'
import { useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { magType } from '@/theme/magazineType'

export const UnderlineInput = memo(({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  large = false,
  style,
  onFocus,
  onBlur,
  ...rest
}: {
  label?: string
  value: string
  onChangeText: (text: string) => void
  placeholder?: string
  error?: string
  large?: boolean
} & Omit<TextInputProps, 'value' | 'onChangeText' | 'placeholder' | 'style'> & { style?: TextInputProps['style'] }) => {
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const input = useRef<TextInput>(null)
  const visibility = useFocusVisibility()
  const [focused, setFocused] = useState(false)
  const underlineColor = error ? r.danger : focused ? r.ink : r.hairline
  const underlineWidth = (error != null && error !== '') || focused ? 1.5 : 1
  return (
    <View>
      {label
        ? (
          <Text
            size={magType.eyebrow.size}
            color={r.eyebrow}
            style={{ fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}
          >{label}</Text>
          )
        : null}
      <TextInput
        ref={input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={r.quiet}
        selectionColor={r.ink}
        cursorColor={r.ink}
        onFocus={(e) => {
          setFocused(true)
          if (input.current) visibility?.focus(input.current)
          onFocus?.(e)
        }}
        onBlur={(e) => {
          setFocused(false)
          if (input.current) visibility?.blur(input.current)
          onBlur?.(e)
        }}
        style={[{
          fontSize: large ? magType.searchInput.size : 16,
          fontWeight: large ? '800' : '600',
          color: r.ink,
          paddingVertical: 8,
          paddingHorizontal: 0,
          borderBottomWidth: underlineWidth,
          borderBottomColor: underlineColor,
          includeFontPadding: false,
        }, style]}
        {...rest}
      />
      {error
        ? <Text size={12} color={r.danger} style={{ marginTop: 6 }}>{error}</Text>
        : null}
    </View>
  )
})
