/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import { TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { createStyle } from '@/utils/tools'
import { radioSession } from './radio'
import { type RadioTaste } from './radioSession'

const tastes: RadioTaste[] = ['familiar', 'balanced', 'explore']
const useStyles = sharedLuxStyles(colors => {
  const r = magazineRoles(colors)
  return createStyle({
    row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, marginBottom: 4 },
    segment: { flexDirection: 'row', borderWidth: 1.5, borderColor: r.ink, borderRadius: 16 },
    option: { height: 28, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center' },
  })
})
export const RadioTasteControl = ({ taste }: { taste: RadioTaste }) => {
  const t = useI18n()
  const r = magazineRoles(useLuxTheme().colors)
  const styles = useStyles()
  return (
    <View style={styles.row}>
      <Text size={12} color={r.muted} style={{ fontWeight: '700' }}>{t('radio_taste')}</Text>
      <View style={styles.segment}>
        {tastes.map((level, index) => (
          <TouchableOpacity key={level} accessibilityRole="radio" accessibilityState={{ checked: taste == level }}
            onPress={() => { radioSession.setTaste(level); void radioSession.replenish().catch(() => {}) }} activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 0, right: 0 }}
            style={[styles.option, { backgroundColor: taste == level ? r.ink : r.paper, borderTopLeftRadius: index == 0 ? 14 : 0, borderBottomLeftRadius: index == 0 ? 14 : 0, borderTopRightRadius: index == 2 ? 14 : 0, borderBottomRightRadius: index == 2 ? 14 : 0 }]}>
            <Text size={13} color={taste == level ? r.onInk : r.ink} style={{ fontWeight: '700' }}>{t(`radio_taste_${level}`)}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}
