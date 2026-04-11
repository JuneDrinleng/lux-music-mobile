/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

// Lux Proprietary
import { memo, useRef, forwardRef, useImperativeHandle } from 'react'
import { TextInput, View, type TextInputProps } from 'react-native'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { Icon } from '@/components/common/Icon'

export interface SearchBarProps extends Omit<TextInputProps, 'onChange'> {
  value: string
  onChangeText: (text: string) => void
}

export interface SearchBarType {
  focus: () => void
  blur: () => void
}

export default memo(forwardRef<SearchBarType, SearchBarProps>(({ value, onChangeText, style, ...props }, ref) => {
  const inputRef = useRef<TextInput>(null)
  const theme = useTheme()

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    blur: () => inputRef.current?.blur(),
  }))

  return (
    <View style={[styles.container, { backgroundColor: theme['c-main-background'], borderColor: theme['c-border-background'] }, style]}>
      <Icon name="search-2" size={16} color={theme['c-500']} />
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={theme['c-500']}
        selectionColor={theme['c-primary']}
        style={[styles.input, { color: theme['c-font'] }]}
        {...props}
      />
    </View>
  )
}))

const styles = createStyle({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  input: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
  },
})
