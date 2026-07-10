import { createI18n } from '@/lang/i18n'
import type { I18n } from '@/lang/i18n'
import { getDeviceLanguage } from '@/utils/tools'
import { setLanguage, updateSetting } from '@/core/common'

const normalizeDeviceLanguage = (language: string): I18n['locale'] | null => {
  const lang = language.toLowerCase().replace('-', '_')
  if (lang.startsWith('zh_tw') || lang.startsWith('zh_hk') || lang.startsWith('zh_mo') || lang.includes('hant')) return 'zh_tw'
  if (lang.startsWith('zh')) return 'zh_cn'
  if (lang.startsWith('en')) return 'en_us'
  return null
}

export default async(setting: LX.AppSetting) => {
  let lang = setting['common.langId']

  global.i18n = createI18n()

  if (!lang || !global.i18n.availableLocales.includes(lang)) {
    const deviceLanguage = normalizeDeviceLanguage(await getDeviceLanguage())
    if (deviceLanguage && global.i18n.availableLocales.includes(deviceLanguage)) {
      lang = deviceLanguage
    } else {
      lang = 'en_us'
    }
    updateSetting({ 'common.langId': lang })
  }
  setLanguage(lang)
}
