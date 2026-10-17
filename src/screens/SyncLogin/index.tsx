/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { resolveSyncLoginEntry, syncLoginExitTarget } from '@/utils/syncLoginRouting'
import SyncLoginLocalAction from './LocalAction'
import AuthFlow from '../Login/AuthFlow'
import ServerStep from '../Login/ServerStep'
import { getPreferredSyncHost, addSyncHostHistory, findLuxAuthForHost, getSyncMode, setSyncHost, setSyncLoginCompleted, setSyncMode } from '@/utils/data'
import { memo, useCallback, useEffect, useState } from 'react'
import { BackHandler, ScrollView, View } from 'react-native'
import LanguageSwitch from '@/components/common/LanguageSwitch'
import StatusBar from '@/components/common/StatusBar'
import Text from '@/components/common/Text'
import {
  BackButton,
  PrimaryButton,
  TextButton,
  TextTabs,
  UnderlineInput,
} from '@/components/magazine'
import { MdiIcon } from '@/components/common/MdiIcon'
import { SYNC_CODE } from '@/plugins/sync/constants'
import { canReuseLuxSession } from '@/plugins/sync/client/credentials'
import { luxSessionExpiredMessage, profileSyncErrorMessage } from '@/plugins/sync/client/userErrors'
import { connectLuxServer, connectServer, syncLuxProfileOnLogin } from '@/plugins/sync'
import { updateSetting } from '@/core/common'
import { completeOnboarding } from '@/utils/onboarding'
import { enterLocalSpace } from '@/utils/enterLocalSpace'
import { navigations } from '@/navigation'
import { useI18n } from '@/lang'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { PAGE_GUTTER, magType } from '@/theme/magazineType'
import { createStyle, toast } from '@/utils/tools'
import { useStatusbarHeight } from '@/store/common/hook'
import { clearSavedSyncLoginCredentialsForMode } from '@/utils/syncLoginCredentialPersistence'
import {
  loadSyncLoginFormSnapshot,
  rememberSyncLoginForm,
  syncLoginSavedSecretDisplayValue,
  syncLoginSavedSecretInputValue,
} from '@/utils/syncLoginPrefill'

const syncHostRxp = /^https?:\/\/\S+/i

export const LegacySyncLogin = memo(({ onboarding = false, initialHost = '', initialMode, onLux, onBack }: { onboarding?: boolean, initialHost?: string, initialMode?: LX.Sync.Mode, onLux?: () => void, onBack?: () => void }) => {
  const styles = useStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const t = useI18n()
  const statusBarHeight = useStatusbarHeight()
  const [mode, setMode] = useState<LX.Sync.Mode>(initialMode ?? 'lux')
  const [syncHost, setSyncHostLocal] = useState('')
  const [authCode, setAuthCode] = useState('')
  const [luxUsername, setLuxUsername] = useState('')
  const [luxPassword, setLuxPassword] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [hasSavedLuxSession, setHasSavedLuxSession] = useState(false)
  const [showLxSavedHint, setShowLxSavedHint] = useState(false)
  const [lxSavedSecretMaskVisible, setLxSavedSecretMaskVisible] = useState(true)

  const applySnapshot = useCallback((snapshot: Awaited<ReturnType<typeof loadSyncLoginFormSnapshot>>) => {
    const differentServer = Boolean(initialHost && initialHost !== snapshot.host)
    setSyncHostLocal(initialHost || snapshot.host)
    setLuxUsername(differentServer ? '' : snapshot.luxUsername)
    setLuxPassword(differentServer ? '' : snapshot.luxPassword)
    setAuthCode(snapshot.lxAuthCode)
    setHasSavedLuxSession(!differentServer && snapshot.hasSavedLuxSession)
    setShowLxSavedHint(snapshot.hasSavedLxKey)
    setLxSavedSecretMaskVisible(true)
  }, [initialHost])

  const applySavedFormForMode = useCallback(async(activeMode: LX.Sync.Mode) => {
    const snapshot = await loadSyncLoginFormSnapshot(activeMode)
    setMode(activeMode)
    applySnapshot(snapshot)
  }, [applySnapshot])

  useEffect(() => {
    void (async() => {
      await applySavedFormForMode(onboarding ? 'lux' : initialMode ?? await getSyncMode())
    })()
    const handlePresented = async() => {
      await applySavedFormForMode(onboarding ? 'lux' : initialMode ?? await getSyncMode())
    }
    global.app_event.on('syncLoginPresented', handlePresented)
    return () => { global.app_event.off('syncLoginPresented', handlePresented) }
  }, [applySavedFormForMode, initialMode, onboarding])

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { if (!submitting) onBack?.(); return true })
    return () => { subscription.remove() }
  }, [onBack, submitting])

  const enterHome = useCallback(async() => {
    if (onboarding) await completeOnboarding()
    await setSyncLoginCompleted(true)
    await navigations.pushHomeScreen()
    global.lx.isShowingLaunchScreen = false
    void global.lx._onLoginConfirmed?.()
  }, [onboarding])

  const handleSelectMode = useCallback((nextMode: LX.Sync.Mode) => {
    if (submitting) return
    if (nextMode === 'lux' && onLux) { onLux(); return }
    setMessage('')
    void applySavedFormForMode(nextMode)
  }, [applySavedFormForMode, onLux, submitting])

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
      const savedLux = await findLuxAuthForHost(host)
      const canUseSavedLux = canReuseLuxSession(savedLux, username)
      if (!username || (!luxPassword && !canUseSavedLux)) {
        setMessage(t('setting_sync_lux_login_missing_tip'))
        return
      }
    }

    setSubmitting(true)
    setMessage('')
    try {
      await setSyncMode(mode)
      await setSyncHost(host)
      await addSyncHostHistory(host)
      updateSetting({ 'sync.enable': true })
      if (mode == 'lux') {
        const password = luxPassword || undefined
        await connectLuxServer(host, username, password)
        await syncLuxProfileOnLogin(host).catch(error => { toast(profileSyncErrorMessage(error), 'long') })
      } else await connectServer(host, code || undefined)
      await rememberSyncLoginForm({
        host,
        mode,
        luxUsername: username,
        luxPassword,
        lxAuthCode: code,
      })
      await enterHome()
    } catch (err: any) {
      setSubmitting(false)
      setMessage(err?.message == SYNC_CODE.luxSessionExpired ? luxSessionExpiredMessage() : String(err?.message ?? err))
    }
  }, [authCode, enterHome, luxPassword, luxUsername, mode, submitting, syncHost, t])

  const handleClearSavedLogin = useCallback(async() => {
    if (submitting) return
    setSubmitting(true)
    setMessage('')
    try {
      await clearSavedSyncLoginCredentialsForMode(mode)
      await applySavedFormForMode(mode)
    } catch (err: any) {
      setMessage(String(err?.message ?? err))
    } finally {
      setSubmitting(false)
    }
  }, [applySavedFormForMode, mode, submitting])

  const isLuxMode = mode == 'lux'
  const hasSavedLoginForMode = isLuxMode
    ? Boolean(hasSavedLuxSession || luxUsername.trim() || luxPassword)
    : Boolean(showLxSavedHint || authCode.trim())

  const handleUseWithoutSync = useCallback(async() => {
    if (submitting) return
    setSubmitting(true)
    setMessage('')
    try {
      await enterLocalSpace(t('sync_login_local_user_name'))
      await setSyncMode('lx')
      await enterHome()
    } catch (err: any) {
      setSubmitting(false)
      setMessage(String(err?.message ?? err))
    }
  }, [enterHome, submitting, t])

  const lxAuthCodeDisplay = syncLoginSavedSecretDisplayValue(
    authCode,
    showLxSavedHint,
    lxSavedSecretMaskVisible,
  )
  const handleLxAuthCodeChange = useCallback((nextValue: string) => {
    setAuthCode(syncLoginSavedSecretInputValue(nextValue, lxAuthCodeDisplay))
  }, [lxAuthCodeDisplay])

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
          {onBack ? <BackButton onPress={() => { if (!submitting) onBack() }} accessibilityLabel={t('back')} /> : null}
          <Text size={magType.eyebrow.size} color={r.eyebrow} style={styles.eyebrow}>{t('sync_login_welcome_eyebrow')}</Text>
          <LanguageSwitch />
        </View>

        <Text size={magType.h2.size} color={r.display} style={styles.title}>{t('sync_login_title')}</Text>
        <Text size={15} color={r.muted} style={styles.subtitle}>{t('sync_login_subtitle')}</Text>

        {onboarding ? null : <TextTabs
          style={styles.tabs}
          value={mode}
          onChange={(id) => { handleSelectMode(id as LX.Sync.Mode) }}
          items={[
            { id: 'lux', label: t('sync_login_tab_lux') },
            { id: 'lx', label: t('sync_login_tab_lx') },
          ]}
        />}

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
                {hasSavedLuxSession
                  ? <Text size={12} color={r.muted} style={styles.lxHint}>{t('sync_login_lux_saved_hint')}</Text>
                  : null}
              </>
            : <>
                <UnderlineInput
                  label={t('setting_sync_code_label')}
                  placeholder={t('setting_sync_code_input_tip')}
                  value={lxAuthCodeDisplay}
                  onChangeText={handleLxAuthCodeChange}
                  onFocus={() => { setLxSavedSecretMaskVisible(false) }}
                  onBlur={() => { setLxSavedSecretMaskVisible(true) }}
                  secureTextEntry
                />
                <Text size={12} color={r.muted} style={styles.lxHint}>{t('sync_login_lx_code_hint')}</Text>
                {showLxSavedHint
                  ? <Text size={12} color={r.muted} style={styles.lxHint}>{t('sync_login_lx_saved_hint')}</Text>
                  : null}
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
        {hasSavedLoginForMode
          ? <View style={styles.clearSavedWrap}>
              <TextButton
                label={t('sync_login_clear_saved')}
                onPress={() => { void handleClearSavedLogin() }}
                muted
                disabled={submitting}
              />
            </View>
          : null}

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
  clearSavedWrap: {
    marginTop: 8,
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


export default function SyncLogin({ onboarding = false, initialHost = '' }: { onboarding?: boolean, initialHost?: string }) {
  const t = useI18n()
  const [host, setHost] = useState(initialHost)
  const [legacy, setLegacy] = useState(false)
  const [localBusy, setLocalBusy] = useState(false)
  const [ready, setReady] = useState(onboarding)
  useEffect(() => {
    let active = true
    if (onboarding) { setReady(true); return }
    const load = async() => {
      const [mode, savedHost] = await Promise.all([getSyncMode(), getPreferredSyncHost()])
      if (!active) return
      const entry = resolveSyncLoginEntry(onboarding, mode, initialHost, savedHost)
      setLegacy(entry.legacy)
      setHost(entry.host)
      setReady(true)
    }
    void load()
    global.app_event.on('syncLoginPresented', load)
    return () => { active = false; global.app_event.off('syncLoginPresented', load) }
  }, [initialHost, onboarding])
  const exit = () => {
    if (localBusy) return
    if (syncLoginExitTarget(onboarding) === 'onboarding') void navigations.pushLoginScreen()
    else void navigations.pushHomeScreen()
  }
  if (!ready) return null
  if (legacy && !onboarding) return <LegacySyncLogin initialHost={initialHost} initialMode="lx" onLux={() => { setLegacy(false); setHost('') }} onBack={exit} />
  if (!host) {
    return <ServerStep onBack={exit} onReady={setHost} showHistory={!onboarding} disabled={localBusy}>
      {!onboarding ? <>
        <TextButton compact style={{ minHeight: 28 }} label={t('sync_login_use_lx')} disabled={localBusy} onPress={() => { setLegacy(true) }} />
        <SyncLoginLocalAction onBusyChange={setLocalBusy} />
      </> : null}
    </ServerStep>
  }
  return <AuthFlow key={host} host={host} onboarding={onboarding} onBack={() => { setHost('') }} />
}
