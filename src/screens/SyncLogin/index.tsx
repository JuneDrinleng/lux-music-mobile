/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo, useCallback, useEffect, useState } from 'react'
import { BackHandler, ScrollView, View } from 'react-native'
import LanguageSwitch from '@/components/common/LanguageSwitch'
import StatusBar from '@/components/common/StatusBar'
import Text from '@/components/common/Text'
import {
  PrimaryButton,
  TextButton,
  TextTabs,
  UnderlineInput,
} from '@/components/magazine'
import { MdiIcon } from '@/components/common/MdiIcon'
import { connectLuxServer, connectServer, disconnectServer, syncLuxProfileOnLogin } from '@/plugins/sync'
import { updateSetting } from '@/core/common'
import { navigations } from '@/navigation'
import { useI18n } from '@/lang'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { PAGE_GUTTER, magType } from '@/theme/magazineType'
import { createStyle } from '@/utils/tools'
import { useStatusbarHeight } from '@/store/common/hook'
import { addSyncHostHistory, clearLuxAuth, clearSyncAuthKey, getSyncHost, getSyncMode, saveUserName, setSyncHost, setSyncLoginCompleted, setSyncMode } from '@/utils/data'

const syncHostRxp = /^https?:\/\/\S+/i

export default memo(() => {
  const styles = useStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const t = useI18n()
  const statusBarHeight = useStatusbarHeight()
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
    <View style={[styles.container, { backgroundColor: r.paper, paddingTop: statusBarHeight }]}>
      <StatusBar />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <Text size={magType.eyebrow.size} color={r.eyebrow} style={styles.eyebrow}>{t('sync_login_welcome_eyebrow')}</Text>
          <LanguageSwitch />
        </View>

        <Text size={magType.h2.size} color={r.display} style={styles.title}>{t('sync_login_title')}</Text>
        <Text size={15} color={r.muted} style={styles.subtitle}>{t('sync_login_subtitle')}</Text>

        <TextTabs
          style={styles.tabs}
          value={mode}
          onChange={(id) => { handleSelectMode(id as LX.Sync.Mode) }}
          items={[
            { id: 'lux', label: t('sync_login_tab_lux') },
            { id: 'lx', label: t('sync_login_tab_lx') },
          ]}
        />

        <Text size={13} color={r.muted} style={styles.formLead}>
          {isLuxMode ? t('sync_login_lux_desc') : t('sync_login_lx_desc')}
        </Text>

        <View style={styles.fields}>
          <UnderlineInput
            label={t('setting_sync_host_label')}
            placeholder={t('setting_sync_host_value_tip')}
            value={syncHost}
            onChangeText={setSyncHostLocal}
            inputMode="url"
            autoCapitalize="none"
          />
          {isLuxMode
            ? <>
                <UnderlineInput
                  label={t('sync_login_lux_account_label')}
                  placeholder={t('setting_sync_lux_username')}
                  value={luxUsername}
                  onChangeText={setLuxUsername}
                  autoCapitalize="none"
                />
                <UnderlineInput
                  label={t('setting_sync_lux_password')}
                  placeholder={t('setting_sync_lux_password')}
                  value={luxPassword}
                  onChangeText={setLuxPassword}
                  secureTextEntry
                />
              </>
            : <>
                <UnderlineInput
                  label={t('setting_sync_code_label')}
                  placeholder={t('setting_sync_code_input_tip')}
                  value={authCode}
                  onChangeText={setAuthCode}
                />
                <Text size={12} color={r.muted} style={styles.lxHint}>{t('sync_login_lx_code_hint')}</Text>
              </>}
        </View>

        {message ? <Text size={13} color={r.danger} style={styles.message}>{message}</Text> : null}

        <PrimaryButton
          label={submitting ? t('sync_login_submitting') : (isLuxMode ? t('sync_login_lux_submit') : t('sync_login_lx_submit'))}
          onPress={() => { void handleSubmit() }}
          disabled={submitting}
          style={styles.primary}
        />
        <View style={styles.skipWrap}>
          <TextButton
            label={t('sync_login_skip')}
            onPress={() => { void handleUseWithoutSync() }}
            muted
            disabled={submitting}
          />
        </View>

        <View style={styles.note}>
          <MdiIcon name="information-outline" size={16} color={r.quiet} />
          <Text size={12} color={r.muted} style={styles.noteText}>{t('sync_login_skip_note')}</Text>
        </View>
      </ScrollView>
    </View>
  )
})

const useStyles = sharedLuxStyles(() => createStyle({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: PAGE_GUTTER,
    paddingTop: 10,
    paddingBottom: 36,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  eyebrow: {
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: {
    fontWeight: '800',
    letterSpacing: -0.8,
    marginBottom: 8,
  },
  subtitle: {
    lineHeight: 22,
  },
  tabs: {
    marginTop: 22,
  },
  formLead: {
    marginTop: 18,
    lineHeight: 19,
    marginBottom: 8,
  },
  fields: {
    gap: 18,
  },
  lxHint: {
    lineHeight: 18,
    marginTop: -6,
  },
  message: {
    lineHeight: 19,
    marginTop: 14,
  },
  primary: {
    marginTop: 24,
  },
  skipWrap: {
    marginTop: 14,
    alignItems: 'center',
  },
  note: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    marginTop: 28,
  },
  noteText: {
    flex: 1,
    lineHeight: 18,
  },
}))
