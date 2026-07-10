import { memo } from 'react'
import { StyleSheet, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import { setLanguage } from '@/core/common'
import { useI18n } from '@/lang'
import type { I18n } from '@/lang/i18n'
import { useTheme } from '@/store/theme/hook'
import { scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'

const languageOptions: Array<{ locale: I18n['locale'], label: string }> = [
  { locale: 'zh_cn', label: '简体' },
  { locale: 'zh_tw', label: '繁體' },
  { locale: 'en_us', label: 'EN' },
]

export default memo(() => {
  const t = useI18n()
  const theme = useTheme()
  const activeLocale = global.i18n?.locale ?? 'en_us'

  return (
    <View style={styles.container}>
      <Text size={12} color={theme['c-500']} style={styles.label}>{t('language_switch_label')}</Text>
      <View style={[styles.options, { backgroundColor: theme['c-main-background'], borderColor: theme['c-border-background'] }]}>
        {languageOptions.map(option => {
          const isActive = option.locale == activeLocale
          return (
            <TouchableOpacity
              key={option.locale}
              activeOpacity={0.78}
              onPress={() => { setLanguage(option.locale) }}
              style={[styles.option, isActive && { backgroundColor: theme['c-primary'] }]}
            >
              <Text size={12} color={isActive ? '#fff' : theme['c-600']} style={styles.optionText}>{option.label}</Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  label: {
    marginBottom: scaleSizeH(8),
  },
  options: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: scaleSizeW(14),
    padding: scaleSizeW(3),
  },
  option: {
    minWidth: scaleSizeW(46),
    height: scaleSizeH(30),
    borderRadius: scaleSizeW(11),
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    fontWeight: '700',
  },
})
