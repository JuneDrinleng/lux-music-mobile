/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md. */
import { type ReactNode } from 'react'
import { TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import { Hairline } from '@/components/magazine'
import { useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { createStyle } from '@/utils/tools'

const styles = createStyle({ row: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12 }, title: { fontWeight: '700' }, subtitle: { marginTop: 2 } })
export const DownloadRow = ({ title, subtitle, trailing, onPress }: { title: string, subtitle?: string, trailing?: ReactNode, onPress?: () => void }) => {
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const body = <View style={styles.row}><View style={{ flex: 1 }}><Text size={15} color={r.list} style={styles.title}>{title}</Text>{subtitle ? <Text size={12} color={r.muted} style={styles.subtitle}>{subtitle}</Text> : null}</View>{trailing}</View>
  return <View>{onPress ? <TouchableOpacity accessibilityRole="button" activeOpacity={0.7} onPress={onPress}>{body}</TouchableOpacity> : body}<Hairline /></View>
}
