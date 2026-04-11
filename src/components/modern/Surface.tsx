/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

// Lux Proprietary
import { memo, type ReactNode } from 'react'
import { View, type ViewProps } from 'react-native'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'

export default memo(({
  children,
  style,
  outlined = true,
  padding = 14,
}: {
  children?: ReactNode
  style?: ViewProps['style']
  outlined?: boolean
  padding?: number
}) => {
  const theme = useTheme()

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: theme['c-main-background'],
          borderColor: outlined ? theme['c-border-background'] : 'transparent',
          padding,
        },
        style,
      ]}
    >
      {children}
    </View>
  )
})

const styles = createStyle({
  base: {
    borderWidth: 1,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
})
