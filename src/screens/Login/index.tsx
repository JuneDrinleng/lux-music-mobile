import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { BackHandler, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import CheckBox from '@/components/common/CheckBox'
import LanguageSwitch from '@/components/common/LanguageSwitch'
import StatusBar from '@/components/common/StatusBar'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'
import { storageDataPrefix } from '@/config/constant'
import { saveData } from '@/plugins/storage'
import { updateSetting } from '@/core/common'
import { navigations } from '@/navigation'
import { pushAgreementScreen } from '@/navigation/navigation'
import { useI18n } from '@/lang'
import type { Message } from '@/lang'

const itemKeys = ['cheatTip', 'pact', 'freeOpenSource'] as const
const getItemLabelKey = (key: typeof itemKeys[number]) => `login_${key}_label` as keyof Message

export default memo(({ componentId }: { componentId: string }) => {
  const theme = useTheme()
  const t = useI18n()
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [confirming, setConfirming] = useState(false)

  const items = useMemo(() => itemKeys.map(key => ({ key, required: true })), [])

  const allRequiredChecked = useMemo(() =>
    items.every(item => !item.required || (checked[item.key] ?? false)),
  [checked, items])

  const handleToggle = useCallback((key: string) => {
    setChecked(prev => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const handleConfirm = useCallback(async() => {
    if (!allRequiredChecked || confirming) return
    setConfirming(true)

    if (checked.cheatTip) {
      await saveData(storageDataPrefix.cheatTip, true)
    }
    if (checked.pact) {
      updateSetting({ 'common.isAgreePact': true })
    }

    await navigations.pushSyncLoginScreen()
  }, [allRequiredChecked, confirming, checked])

  // 阻止返回键退出登录页
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true)
    return () => { subscription.remove() }
  }, [])

  return (
    <View style={[styles.container, { backgroundColor: theme['c-content-background'] }]}>
      <StatusBar />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={[styles.iconWrap, { backgroundColor: theme['c-main-background'] }]}>
            <Image
              source={require('../../../assets/img/whitebg.png')}
              style={styles.icon}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.title} size={26}>Lux Music</Text>
          <View style={styles.languageSwitch}>
            <LanguageSwitch />
          </View>
        </View>

        <View style={styles.checkList}>
          {items.map(item => (
            <View key={item.key} style={styles.checkItem}>
              <CheckBox
                check={!!checked[item.key]}
                onChange={() => { handleToggle(item.key) }}
                need={false}
                marginBottom={8}
              >
                <Text size={15}>{t(getItemLabelKey(item.key))}</Text>
              </CheckBox>
              {item.key === 'pact' ? (
                <Text style={styles.checkDesc} color={theme['c-500']} size={12}>
                  {t('login_pact_desc_prefix')}
                  <Text
                    style={{ textDecorationLine: 'underline' }}
                    color={theme['c-primary']}
                    size={12}
                    onPress={() => { pushAgreementScreen(componentId, 'pact') }}
                  >{t('login_pact_desc_link')}</Text>
                </Text>
              ) : item.key === 'cheatTip' ? (
                <Text style={styles.checkDesc} color={theme['c-500']} size={12}>
                  {t('login_cheatTip_desc_prefix')}
                  <Text
                    style={{ textDecorationLine: 'underline' }}
                    color={theme['c-primary']}
                    size={12}
                    onPress={() => { pushAgreementScreen(componentId, 'cheat-tip') }}
                  >{t('login_cheatTip_desc_link')}</Text>
                </Text>
              ) : (
                <Text style={styles.checkDesc} color={theme['c-500']} size={12}>
                  {t('login_freeOpenSource_desc')}
                </Text>
              )}
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[
            styles.confirmBtn,
            { backgroundColor: theme['c-primary'] },
            (!allRequiredChecked || confirming) && { opacity: 0.4 },
          ]}
          onPress={handleConfirm}
          disabled={!allRequiredChecked || confirming}
        >
          <Text color="#fff" size={16} style={styles.confirmBtnText}>{t('login_next')}</Text>
        </Pressable>
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: scaleSizeH(28),
    paddingHorizontal: scaleSizeW(24),
  },
  header: {
    alignItems: 'center',
    marginBottom: scaleSizeH(36),
  },
  iconWrap: {
    width: scaleSizeW(92),
    height: scaleSizeW(92),
    borderRadius: scaleSizeW(18),
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  icon: {
    width: '100%',
    height: '100%',
  },
  title: {
    marginTop: scaleSizeH(18),
    fontWeight: '600',
  },
  languageSwitch: {
    marginTop: scaleSizeH(18),
  },
  checkList: {
    marginTop: scaleSizeH(12),
  },
  checkItem: {
    marginBottom: scaleSizeH(20),
  },
  checkDesc: {
    marginLeft: scaleSizeW(36),
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: scaleSizeW(24),
    paddingBottom: scaleSizeH(28),
    paddingTop: scaleSizeH(12),
  },
  confirmBtn: {
    height: scaleSizeH(48),
    borderRadius: scaleSizeW(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    fontWeight: '600',
  },
})
