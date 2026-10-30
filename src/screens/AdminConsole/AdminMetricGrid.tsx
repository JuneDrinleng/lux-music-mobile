import { View } from 'react-native'
import Text from '@/components/common/Text'
import { Hairline } from '@/components/magazine'
import { magazineRoles } from '@/theme/magazineRoles'
import { useLuxTheme } from '@/theme/LuxTheme'
import { magType } from '@/theme/magazineType'
import { adminMetricType, useAdminConsoleStyles } from './useAdminConsoleStyles'

export interface AdminMetricItem {
  key: string
  label: string
  value: string
}

export const AdminMetricGrid = ({ items }: { items: AdminMetricItem[] }) => {
  const styles = useAdminConsoleStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)

  return (
    <View style={styles.metricGrid}>
      {items.map((item, index) => (
        <View key={item.key} style={styles.metricCell}>
          <Text size={adminMetricType.size} lineHeight={adminMetricType.lineHeight} color={r.ink} style={styles.metricValue} numberOfLines={1}>
            {item.value}
          </Text>
          <Text size={magType.meta.size} color={r.muted} style={styles.metricLabel}>{item.label}</Text>
          {index % 2 === 1 && index < items.length - 1
            ? (
              <View style={styles.metricRuleRow}>
                <Hairline />
              </View>
              )
            : null}
        </View>
      ))}
    </View>
  )
}
