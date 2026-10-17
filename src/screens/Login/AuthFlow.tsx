/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { useEffect, useRef, useState } from 'react'
import { BackHandler, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native'
import Text from '@/components/common/Text'
import StatusBar from '@/components/common/StatusBar'
import { BackButton, OptionRow, PrimaryButton, TextButton, UnderlineInput } from '@/components/magazine'
import { useLuxTheme, sharedLuxStyles } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { createStyle, clipboardWriteText, toast } from '@/utils/tools'
import { useStatusbarHeight } from '@/store/common/hook'
import useSystemGestureInsetBottom from '@/utils/hooks/useSystemGestureInsetBottom'
import { useI18n } from '@/lang'
import { helpMessage, loginErrors, registerErrors, TODO_AUTH_CONTRACT, type RegisterForm } from '@/utils/luxAuthApi'
import { parseServerInfo, type ServerInfo } from '@/utils/serverCheck'
import { luxAuthApi, requestJson } from '@/plugins/sync/client/auth'
import { connectLuxServer, syncLuxProfileOnLogin } from '@/plugins/sync'
import { profileSyncErrorMessage } from '@/plugins/sync/client/userErrors'
import { updateSetting } from '@/core/common'
import { addSyncHostHistory, setSyncHost, setSyncMode, setSyncLoginCompleted } from '@/utils/data'
import { completeOnboarding } from '@/utils/onboarding'
import { navigations } from '@/navigation'

type Page = 'login' | 'register' | 'forgot'
const emptyForm: RegisterForm = { invite: '', username: '', displayName: '', password: '', confirm: '' }

export default function AuthFlow({ host, onboarding, onBack }: { host: string, onboarding: boolean, onBack: () => void }) {
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const styles = useStyles()
  const t = useI18n()
  const statusHeight = useStatusbarHeight()
  const bottom = useSystemGestureInsetBottom()
  const [page, setPage] = useState<Page>('login')
  const [form, setForm] = useState(emptyForm)
  const [info, setInfo] = useState<ServerInfo | null>(null)
  const [admin, setAdmin] = useState<{ username: string, displayName?: string } | null>(null)
  const [adminOption, setAdminOption] = useState(true)
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  const [message, setMessage] = useState('')
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [invite, setInvite] = useState<{ code: string, inviter?: string, error?: string } | null>(null)
  const hostname = host.replace(/^https?:\/\//, '').split('/')[0]
  const back = () => {
    if (busy) return
    setMessage('')
    setTouched({})
    if (page === 'login') onBack()
    else setPage('login')
  }
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { back(); return true })
    return () => { subscription.remove() }
  })
  useEffect(() => {
    let active = true
    void requestJson<unknown>(`${host}/api/server-info`).then(value => {
      const server = parseServerInfo(value)
      if (!active) return
      setInfo(server)
      const contact = (value as Record<string, unknown>)[TODO_AUTH_CONTRACT.adminContactField] as { username?: unknown, displayName?: unknown } | undefined
      if (typeof contact?.username === 'string') setAdmin({ username: contact.username, displayName: typeof contact.displayName === 'string' ? contact.displayName : undefined })
    }).catch(() => {})
    return () => { active = false }
  }, [host])
  useEffect(() => {
    if (page !== 'register' || !form.invite.trim()) return
    let active = true
    const code = form.invite.trim()
    const timer = setTimeout(() => {
      void luxAuthApi.invite(host, code).then(inviter => {
        if (active) setInvite({ code, inviter })
      }).catch((error: unknown) => {
        if (active) setInvite({ code, error: error instanceof Error ? error.message : t('auth_invite_invalid') })
      })
    }, 500)
    return () => { active = false; clearTimeout(timer) }
  }, [form.invite, host, page, t])
  const errors = page === 'register' ? registerErrors(form) : loginErrors(form.username, form.password)
  const validInvite = invite?.code === form.invite.trim() && Boolean(invite.inviter)
  const invalid = Object.values(errors).some(Boolean) || (page === 'register' && !validInvite)
  const submit = async() => {
    if (submitting.current || invalid) return
    submitting.current = true
    setBusy(true)
    setMessage('')
    try {
      if (page === 'register') await luxAuthApi.register(host, form)
      await setSyncMode('lux')
      await setSyncHost(host)
      await addSyncHostHistory(host)
      updateSetting({ 'sync.enable': true })
      // connectLuxServer commits the session and activates its account data space.
      await connectLuxServer(host, form.username.trim(), form.password)
      await syncLuxProfileOnLogin(host).catch(error => { toast(profileSyncErrorMessage(error), 'long') })
      if (onboarding) await completeOnboarding()
      await setSyncLoginCompleted(true)
      await navigations.pushHomeScreen()
      global.lx.isShowingLaunchScreen = false
      void global.lx._onLoginConfirmed?.()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }
  const field = (key: keyof RegisterForm, label: string, hint?: string, secure = false) => {
    const error = errors[key as keyof typeof errors]
    return <View style={styles.field}>
      <Text size={12} color={r.muted} style={styles.bold}>{label}</Text>
      <UnderlineInput
        value={form[key]}
        accessibilityLabel={label}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry={secure}
        editable={!busy}
        onChangeText={value => {
          setForm(previous => ({ ...previous, [key]: value }))
          if (key === 'invite') setInvite(null)
        }}
        onBlur={() => { setTouched(previous => ({ ...previous, [key]: true })) }}
        error={touched[key] && error ? t(error) : undefined}
        style={[styles.input, { borderBottomColor: r.ink }]}
      />
      {hint ? <Text size={12} color={r.muted} style={styles.hint}>{hint}</Text> : null}
      {key === 'invite' && invite?.code === form.invite.trim() ? <Text size={12} color={invite.error ? r.danger : r.accentInk} style={[styles.hint, styles.bold]} accessibilityLiveRegion="polite">{invite.error ?? t('auth_invite_valid', { inviter: invite.inviter ?? '' })}</Text> : null}
    </View>
  }
  const help = helpMessage(form.username, hostname, t)
  const primary = <PrimaryButton compact label={t(page === 'register' ? 'auth_register_submit' : 'auth_login')} disabled={busy || invalid} onPress={() => { void submit() }} />
  return <KeyboardAvoidingView style={[styles.page, { backgroundColor: r.paper, paddingTop: statusHeight }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <StatusBar />
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.top}><BackButton onPress={back} accessibilityLabel={t('back')} /></View>
      <Text size={11} color={r.eyebrow} style={styles.eyebrow}>{page === 'forgot' ? t('auth_forgot_eyebrow') : hostname.toUpperCase()}</Text>
      <Text size={32} color={r.display} style={styles.title}>{t(page === 'forgot' ? 'auth_recover' : page === 'register' ? 'auth_register' : 'auth_login')}</Text>
      {page === 'forgot' ? <>
        <Text size={15} color={r.ink} style={styles.intro}>{t('auth_forgot_intro')}</Text>
        <OptionRow leading label={t('auth_admin_option')} description={t('auth_admin_guidance')} selected={adminOption} onPress={() => { setAdminOption(true) }} />
        <OptionRow leading label={t('auth_device_option')} description={t('auth_device_guidance')} selected={!adminOption} onPress={() => { setAdminOption(false) }} />
        {adminOption ? <View style={[styles.card, { backgroundColor: r.paperRaised }]}>
          <Text size={11} color={r.eyebrow} style={styles.cardEyebrow}>{t('auth_admin')}</Text>
          {admin ? <Text size={15} color={r.list} style={[styles.bold, styles.hint]}>{t('auth_admin_name', { name: admin.displayName ?? admin.username, username: admin.username })}</Text> : null}
          <Text size={12} color={r.muted} style={styles.hint}>{t('auth_copy_intro')}</Text>
          <View style={[styles.helpBox, { borderColor: r.ink }]}><Text size={13} color={r.ink}>{help}</Text></View>
        </View> : null}
      </> : <>
        {page === 'register' ? field('invite', t('auth_invite')) : null}
        {field('username', t('auth_username'), page === 'register' ? t('auth_username_hint') : undefined)}
        {page === 'register' ? field('displayName', t('auth_nickname'), t('auth_nickname_hint')) : null}
        {field('password', t('auth_password'), page === 'register' ? t('auth_password_hint') : undefined, true)}
        {page === 'register' ? field('confirm', t('auth_confirm'), undefined, true) : <>
          <View style={styles.links}>
            <TextButton compact label={t('auth_forgot_link')} disabled={busy} onPress={() => { setPage('forgot'); setMessage('') }} />
            <TextButton compact label={t('auth_change_server')} disabled={busy} onPress={back} />
          </View>
          <View style={styles.loginButton}>{primary}</View>
          {info?.registration.enabled ? <View style={styles.registerLink}>
            <Text size={14} color={r.ink}>{t('auth_no_account')}</Text>
            <TextButton compact label={t('auth_register_link')} disabled={busy} onPress={() => { setPage('register'); setTouched({}); setMessage('') }} />
          </View> : null}
        </>}
      </>}
      {message ? <Text size={12} color={r.danger} style={styles.field} accessibilityLiveRegion="polite">{message}</Text> : null}
    </ScrollView>
    {page === 'register' || (page === 'forgot' && adminOption) ? <View style={[styles.footer, { borderTopColor: r.ink, paddingBottom: 26 + bottom }]}>
      {page === 'register' ? primary : <PrimaryButton compact label={t('auth_copy_help')} onPress={() => { clipboardWriteText(help); toast(t('auth_copied')) }} />}
    </View> : null}
  </KeyboardAvoidingView>
}

const useStyles = sharedLuxStyles(() => createStyle({
  page: { flex: 1 },
  content: { paddingHorizontal: 22, paddingBottom: 28 },
  top: { marginTop: 10, height: 40 },
  eyebrow: { marginTop: 6, fontWeight: '700', letterSpacing: 2 },
  title: { lineHeight: 38, fontWeight: '800' },
  field: { marginTop: 16 },
  bold: { fontWeight: '700' },
  input: { fontWeight: '400', borderBottomWidth: 1.5 },
  hint: { marginTop: 4 },
  links: { marginTop: 14, flexDirection: 'row', justifyContent: 'space-between' },
  loginButton: { marginTop: 26 },
  registerLink: { marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  intro: { marginTop: 16, lineHeight: 23 },
  card: { marginTop: 18, borderRadius: 6, padding: 14 },
  cardEyebrow: { fontWeight: '700', letterSpacing: 2 },
  helpBox: { marginTop: 8, borderWidth: 1.5, borderStyle: 'dashed', padding: 8, borderRadius: 4 },
  footer: { borderTopWidth: 2, paddingHorizontal: 22, paddingTop: 12, paddingBottom: 26 },
}))
