/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

// Lux Proprietary
import { memo, type ReactNode } from 'react'
import { View } from 'react-native'
import Text from '@/components/common/Text'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'

export default memo(({
  title,
  subtitle,
  right,
}: {
  title: string
  subtitle?: string
  right?: ReactNode
}) => {
  const theme = useTheme()

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <Text size={18}>{title}</Text>
        {subtitle ? <Text size={12} color={theme['c-500']}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  )
})

const styles = createStyle({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 10,
  },
  left: {
    flexGrow: 1,
    flexShrink: 1,
  },
  right: {
    flexGrow: 0,
    flexShrink: 0,
    alignItems: 'flex-end',
  },
})
