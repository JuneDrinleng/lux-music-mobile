import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { BackHandler, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import CheckBox from '@/components/common/CheckBox'
import StatusBar from '@/components/common/StatusBar'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'
import { storageDataPrefix } from '@/config/constant'
import { saveData } from '@/plugins/storage'
import { updateSetting } from '@/core/common'
import { navigations } from '@/navigation'
import { pushAgreementScreen } from '@/navigation/navigation'

const ITEMS = [
  {
    key: 'cheatTip',
    label: '我已阅读并了解以上安全提醒',
    desc: '1. 本项目没有任何"官方社群"或"收费解锁"渠道，请注意甄别，谨防受骗。\n\n2. 如果你在使用过程中看到广告、引流或要求付费升级，通常说明你当前使用的是第三方修改版本。\n\n3. 项目主要发布渠道为 GitHub，其他来源请自行判断可信度。',
    required: true,
  },
  {
    key: 'pact',
    label: '我已阅读并完全接受本软件的许可协议',
    desc: '继续使用前请先阅读并接受许可协议，点击查看完整协议',
    required: true,
  },
  {
    key: 'freeOpenSource',
    label: '我已了解本软件为免费开源软件',
    desc: '本软件完全免费且开源，如果你是花钱购买的，请直接给差评！',
    required: true,
  },
] as const

export default memo(({ componentId }: { componentId: string }) => {
  const theme = useTheme()
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [confirming, setConfirming] = useState(false)

  const allRequiredChecked = useMemo(() =>
    ITEMS.every(item => !item.required || (checked[item.key] ?? false)),
  [checked])

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

    await navigations.pushHomeScreen()
    global.lx.isShowingLaunchScreen = false
    void global.lx._onLoginConfirmed?.()
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
        </View>

        <View style={styles.checkList}>
          {ITEMS.map(item => (
            <View key={item.key} style={styles.checkItem}>
              <CheckBox
                check={!!checked[item.key]}
                onChange={() => { handleToggle(item.key) }}
                need={false}
                marginBottom={8}
              >
                <Text size={15}>{item.label}</Text>
              </CheckBox>
              {item.key === 'pact' ? (
                <Text style={styles.checkDesc} color={theme['c-500']} size={12}>
                  继续使用前请先阅读并接受许可协议，
                  <Text
                    style={{ textDecorationLine: 'underline' }}
                    color={theme['c-primary']}
                    size={12}
                    onPress={() => { pushAgreementScreen(componentId, 'pact') }}
                  >点击查看完整协议</Text>
                </Text>
              ) : item.key === 'cheatTip' ? (
                <Text style={styles.checkDesc} color={theme['c-500']} size={12}>
                  使用前请了解安全提醒内容，
                  <Text
                    style={{ textDecorationLine: 'underline' }}
                    color={theme['c-primary']}
                    size={12}
                    onPress={() => { pushAgreementScreen(componentId, 'cheat-tip') }}
                  >点击查看详情</Text>
                </Text>
              ) : (
                <Text style={styles.checkDesc} color={theme['c-500']} size={12}>
                  {item.desc}
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
          <Text color="#fff" size={16} style={styles.confirmBtnText}>进入应用</Text>
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
