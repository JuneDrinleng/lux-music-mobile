import { memo, useCallback, useEffect, useState } from 'react'
import { BackHandler, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native'
import Input from '@/components/common/Input'
import LanguageSwitch from '@/components/common/LanguageSwitch'
import StatusBar from '@/components/common/StatusBar'
import Text from '@/components/common/Text'
import { connectLuxServer, connectServer, disconnectServer, syncLuxProfileOnLogin } from '@/plugins/sync'
import { updateSetting } from '@/core/common'
import { navigations } from '@/navigation'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'
import { addSyncHostHistory, clearLuxAuth, clearSyncAuthKey, getSyncHost, getSyncMode, saveUserName, setSyncHost, setSyncLoginCompleted, setSyncMode } from '@/utils/data'

const syncHostRxp = /^https?:\/\/\S+/i

export default memo(() => {
  const t = useI18n()
  const theme = useTheme()
  const [mode, setMode] = useState<LX.Sync.Mode>('lux')
  const [syncHost, setSyncHostLocal] = useState('')
  const [authCode, setAuthCode] = useState('')
  const [luxUsername, setLuxUsername] = useState('')
  const [luxPassword, setLuxPassword] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    void getSyncMode().then(setMode)
    void getSyncHost().then(host => { setSyncHostLocal(host ?? '') })
  }, [])

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true)
    return () => { subscription.remove() }
  }, [])

  const enterHome = useCallback(async() => {
    await setSyncLoginCompleted(true)
    await navigations.pushHomeScreen()
    global.lx.isShowingLaunchScreen = false
    void global.lx._onLoginConfirmed?.()
  }, [])

  const handleSelectMode = useCallback((nextMode: LX.Sync.Mode) => {
    if (submitting) return
    setMode(nextMode)
    setMessage('')
  }, [submitting])

  const handleSubmit = useCallback(async() => {
    if (submitting) return
    const host = syncHost.trim()
    const username = luxUsername.trim()
    const code = authCode.trim()

    if (!host) {
      setMessage(t('sync_login_host_required_tip'))
      return
    }
    if (!syncHostRxp.test(host)) {
      setMessage(t('setting_sync_host_value_error_tip'))
      return
    }

    if (mode == 'lux') {
      if (!username || !luxPassword) {
        setMessage(t('setting_sync_lux_login_missing_tip'))
        return
      }
    } else if (!code) {
      setMessage(t('sync_login_lx_missing_code_tip'))
      return
    }

    setSubmitting(true)
    setMessage('')
    try {
      await setSyncMode(mode)
      await setSyncHost(host)
      await addSyncHostHistory(host)
      updateSetting({ 'sync.enable': true })
      if (mode == 'lux') {
        await connectLuxServer(host, username, luxPassword)
        await syncLuxProfileOnLogin(host).catch(() => null)
      } else await connectServer(host, code)
      await enterHome()
    } catch (err: any) {
      setSubmitting(false)
      setMessage(String(err?.message ?? err))
    }
  }, [authCode, enterHome, luxPassword, luxUsername, mode, submitting, syncHost, t])

  const handleUseWithoutSync = useCallback(async() => {
    if (submitting) return
    setSubmitting(true)
    setMessage('')
    try {
      await setSyncMode('lx')
      await setSyncHost('')
      await clearLuxAuth()
      await clearSyncAuthKey()
      await saveUserName(t('sync_login_local_user_name'))
      global.app_event.userNameUpdated(t('sync_login_local_user_name'))
      updateSetting({ 'sync.enable': false })
      await disconnectServer()
      await enterHome()
    } catch (err: any) {
      setSubmitting(false)
      setMessage(String(err?.message ?? err))
    }
  }, [enterHome, submitting, t])

  const isLuxMode = mode == 'lux'

  return (
    <View style={[styles.container, { backgroundColor: theme['c-content-background'] }]}>
      <StatusBar />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text size={28} style={styles.title}>{t('sync_login_title')}</Text>
          <Text size={14} color={theme['c-500']} style={styles.subtitle}>{t('sync_login_subtitle')}</Text>
          <View style={styles.languageSwitch}>
            <LanguageSwitch />
          </View>
        </View>

        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[
              styles.modeCard,
              { backgroundColor: theme['c-main-background'], borderColor: isLuxMode ? theme['c-primary'] : theme['c-border-background'] },
            ]}
            activeOpacity={0.82}
            onPress={() => { handleSelectMode('lux') }}
          >
            <Text size={16} style={styles.modeTitle} color={isLuxMode ? theme['c-primary'] : theme['c-font']}>lux music</Text>
            <Text size={12} color={theme['c-500']} style={styles.modeDesc}>{t('sync_login_lux_desc')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.modeCard,
              { backgroundColor: theme['c-main-background'], borderColor: !isLuxMode ? theme['c-primary'] : theme['c-border-background'] },
            ]}
            activeOpacity={0.82}
            onPress={() => { handleSelectMode('lx') }}
          >
            <Text size={16} style={styles.modeTitle} color={!isLuxMode ? theme['c-primary'] : theme['c-font']}>lx music</Text>
            <Text size={12} color={theme['c-500']} style={styles.modeDesc}>{t('sync_login_lx_desc')}</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.formCard, { backgroundColor: theme['c-main-background'], borderColor: theme['c-border-background'] }]}>
          <Text size={13} color={theme['c-500']} style={styles.fieldLabel}>{t('setting_sync_host_label')}</Text>
          <Input
            placeholder={t('setting_sync_host_value_tip')}
            value={syncHost}
            onChangeText={setSyncHostLocal}
            style={[styles.input, { backgroundColor: theme['c-primary-background'] }]}
            inputMode="url"
            autoCapitalize="none"
          />

          {isLuxMode
            ? <>
                <Text size={13} color={theme['c-500']} style={styles.fieldLabel}>{t('sync_login_lux_account_label')}</Text>
                <Input
                  placeholder={t('setting_sync_lux_username')}
                  value={luxUsername}
                  onChangeText={setLuxUsername}
                  style={[styles.input, { backgroundColor: theme['c-primary-background'] }]}
                  autoCapitalize="none"
                />
                <Input
                  placeholder={t('setting_sync_lux_password')}
                  value={luxPassword}
                  onChangeText={setLuxPassword}
                  style={[styles.input, { backgroundColor: theme['c-primary-background'] }]}
                  secureTextEntry
                />
              </>
            : <>
                <Text size={13} color={theme['c-500']} style={styles.fieldLabel}>{t('setting_sync_code_label')}</Text>
                <Input
                  placeholder={t('setting_sync_code_input_tip')}
                  value={authCode}
                  onChangeText={setAuthCode}
                  style={[styles.input, { backgroundColor: theme['c-primary-background'] }]}
                />
                <Text size={12} color={theme['c-500']} style={styles.lxHint}>{t('sync_login_lx_code_hint')}</Text>
              </>}

          {message ? <Text size={13} color="#ef4444" style={styles.message}>{message}</Text> : null}

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: theme['c-primary'] },
              (pressed || submitting) && { opacity: 0.72 },
            ]}
            disabled={submitting}
            onPress={handleSubmit}
          >
            <Text size={16} color="#fff" style={styles.primaryButtonText}>
              {submitting ? t('sync_login_submitting') : isLuxMode ? t('sync_login_lux_submit') : t('sync_login_lx_submit')}
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.skipButton,
              { borderColor: theme['c-border-background'] },
              pressed && { opacity: 0.72 },
            ]}
            disabled={submitting}
            onPress={handleUseWithoutSync}
          >
            <Text size={15} color={theme['c-600']} style={styles.skipButtonText}>{t('sync_login_skip')}</Text>
          </Pressable>
        </View>
      </ScrollView>
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
    paddingHorizontal: scaleSizeW(22),
    paddingVertical: scaleSizeH(28),
  },
  header: {
    marginBottom: scaleSizeH(24),
  },
  title: {
    fontWeight: '700',
    marginBottom: scaleSizeH(8),
  },
  subtitle: {
    lineHeight: 20,
  },
  languageSwitch: {
    marginTop: scaleSizeH(18),
  },
  modeRow: {
    flexDirection: 'row',
    marginHorizontal: scaleSizeW(-5),
    marginBottom: scaleSizeH(14),
  },
  modeCard: {
    flex: 1,
    minHeight: scaleSizeH(92),
    borderWidth: 1,
    borderRadius: scaleSizeW(16),
    paddingHorizontal: scaleSizeW(14),
    paddingVertical: scaleSizeH(13),
    marginHorizontal: scaleSizeW(5),
  },
  modeTitle: {
    fontWeight: '700',
    marginBottom: scaleSizeH(8),
  },
  modeDesc: {
    lineHeight: 18,
  },
  formCard: {
    borderWidth: 1,
    borderRadius: scaleSizeW(18),
    paddingHorizontal: scaleSizeW(16),
    paddingTop: scaleSizeH(18),
    paddingBottom: scaleSizeH(16),
  },
  fieldLabel: {
    marginBottom: scaleSizeH(8),
    marginTop: scaleSizeH(12),
  },
  input: {
    minHeight: scaleSizeH(42),
    borderRadius: scaleSizeW(12),
  },
  lxHint: {
    lineHeight: 18,
    marginTop: scaleSizeH(8),
  },
  message: {
    lineHeight: 19,
    marginTop: scaleSizeH(14),
  },
  primaryButton: {
    height: scaleSizeH(48),
    borderRadius: scaleSizeW(13),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: scaleSizeH(18),
  },
  primaryButtonText: {
    fontWeight: '700',
  },
  skipButton: {
    height: scaleSizeH(46),
    borderRadius: scaleSizeW(13),
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: scaleSizeH(10),
  },
  skipButtonText: {
    fontWeight: '600',
  },
})
