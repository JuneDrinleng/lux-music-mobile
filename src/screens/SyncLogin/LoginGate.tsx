/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Keyboard, KeyboardAvoidingView, Platform, TouchableOpacity, View } from 'react-native'
import { FocusVisibleAction, FocusVisibleScrollView } from '@/components/common/FocusVisibleScrollView'
import { SettingsSubpage, useSettingsSubpage, useSubpageActive } from '@/components/common/SettingsPage'
import { useBackHandler } from '@/utils/hooks/useBackHandler'
import { BackButton, PrimaryButton, SecondaryButton, TextButton, TextTabs, UnderlineInput } from '@/components/magazine'
import Text from '@/components/common/Text'
import { setLanguage } from '@/core/common'
import StatusBar from '@/components/common/StatusBar'
import { useLuxTheme, sharedLuxStyles } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { useStatusbarHeight } from '@/store/common/hook'
import { useI18n } from '@/lang'
import { createStyle, confirmDialog } from '@/utils/tools'
import { appSession, subscribeAppSessionAuthentication, getLoginIntent, connectAppSession, enterLocalAppSession, cancelAppSessionSwitch, cancelAppSessionAuthentication, enterOfflineAppSession } from '@/core/appSession'
import { getLoginRecents, getLoginCredentialAvailability, removeRecentLogin, getSyncHostHistory, removeSyncHostHistory } from '@/utils/data'
import { clearSavedSyncLoginCredentialsForMode } from '@/utils/syncLoginCredentialPersistence'
import { loadSyncLoginFormSnapshot, rememberSyncLoginForm } from '@/utils/syncLoginPrefill'
import { gateDraft, gateInitialPage, recentIdentity, recentLoginAction, type GatePage } from '@/utils/loginGate'
import type { RecentLogin } from '@/utils/loginRecents'
import type { LoginIntent, LoginProvider } from '@/utils/loginSession'
import { normalizeServerUrl, parseServerInfo, versionAtLeast, type ServerInfo } from '@/utils/serverCheck'
import AuthFlow from '../Login/AuthFlow'

export default function LoginGate({ intent: suppliedIntent }: { intent?: LoginIntent }) {
  const intent = useRef(suppliedIntent ?? getLoginIntent()).current
  const { page, pages, setPage, style } = useSettingsSubpage<GatePage>('main', true, gateInitialPage(intent))
  const [recents, setRecents] = useState<RecentLogin[]>([])
  const [availability, setAvailability] = useState<Record<string, boolean>>({})
  const [selected, setSelected] = useState<RecentLogin | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [canCancel, setCanCancel] = useState(false)
  useEffect(() => subscribeAppSessionAuthentication(() => { setCanCancel(appSession.canCancelAuthentication) }), [])
  const locked = useRef(false)
  const t = useI18n()
  const previous = appSession.pending?.previous
  const reload = useCallback(async() => {
    const { recents: items } = await getLoginRecents()
    const available = await Promise.all(items.map(async item => [item.id, item.provider === 'local' || Boolean(item.credentialRef && await getLoginCredentialAvailability(item.credentialRef) === 'available')] as const))
    setRecents(items)
    setAvailability(Object.fromEntries(available))
  }, [])
  useEffect(() => { void reload().catch(error => { setMessage(String(error.message)) }) }, [reload])
  const run = async(action: () => Promise<void>) => {
    if (locked.current) return
    locked.current = true; setBusy(true); setMessage('')
    try { await action() } catch (error) { setMessage(error instanceof Error ? error.message === 'Authentication cancelled' ? t('login_gate_auth_cancelled') : error.message : String(error)) } finally { locked.current = false; setBusy(false) }
  }
  const choose = (provider: LoginProvider) => {
    if (busy) return
    if (Keyboard.isVisible()) Keyboard.dismiss()
    setSelected(null); setHistoryHost(null); setMessage(''); setPage(provider)
  }
  const continueRecent = (recent: RecentLogin) => {
    if (busy) return
    if (Keyboard.isVisible()) Keyboard.dismiss()
    setSelected(recent); setMessage('')
    const action = recentLoginAction(recent, availability[recent.id])
    if (action !== 'continue') { setPage(recent.provider); return }
    void run(async() => {
      // Recheck at use time; authHint and rendered availability are only snapshots.
      if (!recent.credentialRef || await getLoginCredentialAvailability(recent.credentialRef) !== 'available') {
        setAvailability(value => ({ ...value, [recent.id]: false })); setPage(recent.provider); return
      }
      await appSession.selectTarget({ targetProvider: recent.provider, targetIdentity: recentIdentity(recent), targetRecentId: recent.id, initialHost: recent.server?.url, initialUsername: recent.account?.username })
      if (recent.provider !== 'local') {
        try { await connectAppSession(recent.provider, recent.server!.url, recent.account?.username) } catch (error) {
          if (recent.credentialRef && await getLoginCredentialAvailability(recent.credentialRef) !== 'available') {
            setAvailability(value => ({ ...value, [recent.id]: false }))
            setPage(recent.provider)
          }
          throw error
        }
      }
    })
  }
  const back = () => {
    if (Keyboard.isVisible()) { Keyboard.dismiss(); return }
    if (busy) return
    setMessage('')
    if (page === 'history') setPage(historyProvider.current)
    else if (page === 'register' || page === 'forgot') setPage('lux')
    else if (page !== 'main') setPage(page !== 'methods' && pages.includes('methods') ? 'methods' : 'main')
    // Main never silently restores an identity or completes onboarding.
  }
  const name = (recent: RecentLogin) => recent.account?.displayName ?? recent.account?.username ?? t(recent.provider === 'local' ? 'sync_login_tab_local' : 'login_gate_lx_name')
  const previousName = previous?.provider === 'lux' ? previous.account.displayName ?? previous.account.username : t(previous?.provider === 'lx' ? 'login_gate_lx_name' : 'sync_login_tab_local')
  const clear = (provider: 'lx' | 'lux') => {
    void run(async() => {
      const count = recents.filter(item => item.provider === provider).length
      if (!await confirmDialog({ title: t('clear_provider_credentials'), message: t('login_gate_clear_scope', { provider: t(provider === 'lux' ? 'sync_login_tab_lux' : 'sync_login_tab_lx'), count }), cancelButtonText: t('cancel'), confirmButtonText: t('clear_provider_credentials'), confirmDanger: true })) return
      await clearSavedSyncLoginCredentialsForMode(provider)
      await reload()
    })
  }
  const mainRecent = recents.find(item => item.id === intent?.targetRecentId) ?? recents[0]
  const recentRow = (item: RecentLogin, large = false, manage = false) => <RecentRow key={item.id} recent={item} name={name(item)} large={large} onPress={() => { continueRecent(item) }} action={manage ? <TextButton label={t('remove_recent_only')} danger onPress={() => { void run(async() => { await removeRecentLogin(item.id); await reload() }) }} /> : undefined} />
  const renderPage = (scene: GatePage) => {
    if (scene === 'register' || scene === 'forgot') return <AuthFlow host={formHost.current} initialUsername={selected?.account?.username} onboarding={intent?.reason === 'boot'} settings initialPage={scene} cancelAuthentication={() => { void cancelAppSessionAuthentication() }} canCancelAuthentication={canCancel} onBack={back} />
    const provider = scene === 'lux' || scene === 'lx' || scene === 'local' ? scene : null
    const titleKey = scene === 'main' ? previous && intent?.returnPolicy === 'restorePrevious' ? 'login_gate_switch_title' : 'login_gate_title' : scene === 'local' ? 'login_gate_local_title' : scene === 'lux' ? intent?.reason === 'reauth' ? 'login_gate_expired_title' : 'login_gate_lux_title' : scene === 'lx' ? 'login_gate_lx_title' : scene === 'methods' ? 'other_login_methods' : scene === 'manage' ? 'login_gate_manage' : scene === 'history' ? 'sync_login_host_history' : 'login_gate_other_recents'
    return <GateScene onBack={back} root={scene === 'main' || (intent?.reason === 'reauth' && scene === 'lux')} title={t(titleKey)} showLanguage={scene !== 'lux' && scene !== 'lx'}>
      {scene === 'main' || scene === 'methods' ? <>
        <GateLead>{t('login_gate_lead')}</GateLead>
        {previous ? <GateNotice title={t('login_gate_paused_title')} body={t('login_gate_paused_body')} /> : null}
        {scene === 'main' && mainRecent ? <>
          <GateSection title={t('login_gate_recent')} meta={t('login_gate_last_used')} />
          {recentRow(mainRecent, true)}
          <FocusVisibleAction><PrimaryButton label={t(availability[mainRecent.id] || mainRecent.provider === 'local' ? 'continue_account' : 'login_gate_reauth_account', { name: name(mainRecent) })} disabled={busy} onPress={() => { continueRecent(mainRecent) }} /></FocusVisibleAction>
          <GateLinks><TextButton label={t('login_gate_other_recents')} onPress={() => { setPage('recents') }} disabled={busy} /><TextButton label={t('login_gate_manage')} onPress={() => { setPage('manage') }} disabled={busy} /></GateLinks>
        </> : null}
        <GateSection title={t('other_login_methods')} meta="OTHER WAYS" heading />
        {scene === 'main' && mainRecent && previous && intent?.returnPolicy === 'restorePrevious' ? <GateWay index={0} title={t('login_gate_new_method')} subtitle={t('login_gate_new_method_note')} onPress={() => { setPage('methods') }} /> : (['lux', 'lx', 'local'] as const).map((kind, index) => <GateWay key={kind} index={index + 1} title={t(kind === 'lux' ? 'login_gate_lux_name' : kind === 'lx' ? 'sync_login_tab_lx' : 'sync_login_tab_local')} subtitle={t(`login_gate_way_${kind}`)} onPress={() => { choose(kind) }} />)}
        {!mainRecent ? <TextButton label={t('login_gate_manage')} onPress={() => { setPage('manage') }} /> : null}
      </> : provider ? <>
        <GateLead>{intent?.reason === 'reauth' && provider === 'lux' ? t('login_gate_expired_lead', { name: previousName }) : t(`login_gate_${provider}_lead`)}</GateLead>
        {intent?.reason === 'reauth' && provider === 'lux' ? <GateNotice title={t('login_gate_paused_title')} body={t('login_gate_paused_body')} /> : <GateTabs provider={provider} onChange={choose} />}
        {provider === 'local' ? <>
          <LocalDetails />
          <FocusVisibleAction><PrimaryButton label={t('continue_local_no_sync')} disabled={busy} onPress={() => { void run(async() => { await appSession.selectTarget({ targetProvider: 'local', targetIdentity: undefined, targetRecentId: undefined }); await enterLocalAppSession(t('sync_login_local_user_name')) }) }} /></FocusVisibleAction>
          <TextButton label={t('login_gate_back_methods')} onPress={back} disabled={busy} style={{ alignSelf: 'center' }} />
        </> : <GateForm key={`${provider}:${selected?.id ?? ''}`} provider={provider} intent={intent} selected={selected?.provider === provider ? selected : null} busy={busy} run={run} recents={intent?.reason === 'reauth' ? [] : recents.filter(item => item.provider === provider)} onRecent={continueRecent} onHistory={() => { if (Keyboard.isVisible()) Keyboard.dismiss(); historyProvider.current = provider; setPage('history') }} historyHost={historyHost?.provider === provider ? historyHost.host : null} onHost={value => { formHost.current = value }} onRegister={() => { void run(async() => { await appSession.selectTarget({ targetProvider: 'lux', targetIdentity: undefined, targetRecentId: undefined, initialHost: formHost.current }); setPage('register') }) }} onForgot={() => { setPage('forgot') }} onOtherWays={() => { setPage('main') }} />}
      </> : scene === 'history' ? <HostHistory onSelect={host => { setHistoryHost({ provider: historyProvider.current, host }); setPage(historyProvider.current) }} run={run} /> : <>
        {scene === 'manage' ? <GateLead>{t('login_gate_remove_scope')}</GateLead> : null}
        {recents.map(item => recentRow(item, false, scene === 'manage'))}
        {scene === 'manage' ? <>
          <GateSection title={t('clear_provider_credentials')} />
          <TextButton label={t('login_gate_clear_lux')} onPress={() => { clear('lux') }} disabled={busy} />
          <TextButton label={t('login_gate_clear_lx')} onPress={() => { clear('lx') }} disabled={busy} />
        </> : null}
      </>}
      {message ? <GateError>{message}</GateError> : null}
      {busy ? <TextButton label={t('login_gate_cancel_auth')} disabled={!canCancel} onPress={() => { void cancelAppSessionAuthentication() }} /> : null}
      {scene === 'main' && previous && appSession.pending?.intent.returnPolicy === 'restorePrevious' ? <SecondaryButton label={t('cancel_switch_to_account', { name: previousName })} disabled={busy} onPress={() => { void run(cancelAppSessionSwitch) }} /> : null}
      {previous && previous.provider !== 'local' && intent?.reason !== 'logout' && (intent?.reason === 'reauth' || Boolean(message)) ? <><GateSection title={t('login_gate_offline_title')} heading /><GateLead>{t('login_gate_offline_body')}</GateLead><SecondaryButton label={t('view_account_offline', { name: previousName })} disabled={busy} onPress={() => { void run(enterOfflineAppSession) }} /></> : null}
      <GateFootnote>{t(intent?.reason === 'reauth' ? 'login_gate_offline_note' : provider === 'local' ? 'login_gate_local_note' : provider === 'lx' ? 'login_gate_lx_note' : provider === 'lux' ? 'login_gate_password_note' : 'login_gate_note')}</GateFootnote>
    </GateScene>
  }
  const formHost = useRef('')
  const historyProvider = useRef<'lux' | 'lx'>('lux')
  const [historyHost, setHistoryHost] = useState<{ provider: 'lux' | 'lx', host: string } | null>(null)
  return <SettingsSubpage pages={pages} style={style}>{renderPage}</SettingsSubpage>
}

function GateScene({ root, title, onBack, children, showLanguage = true }: { root: boolean, title: string, onBack: () => void, children: ReactNode, showLanguage?: boolean }) {
  const { colors } = useLuxTheme(); const r = magazineRoles(colors); const styles = useStyles(); const top = useStatusbarHeight(); const active = useSubpageActive(); const t = useI18n()
  useBackHandler(() => { if (!active) return false; onBack(); return true })
  return <KeyboardAvoidingView style={[styles.page, { backgroundColor: r.paper, paddingTop: top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <StatusBar /><FocusVisibleScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.top}>{root ? <Text size={11} color={r.eyebrow} style={styles.eyebrow}>LUX MUSIC</Text> : <><BackButton onPress={onBack} accessibilityLabel={t('back')} /><Text size={12} color={r.muted}>{t('login_gate_change_method')}</Text></>}{showLanguage ? <GateLanguage /> : null}</View>
      <Text size={40} color={r.display} style={styles.title}>{title}</Text>{children}
    </FocusVisibleScrollView>
  </KeyboardAvoidingView>
}
function GateLead({ children }: { children: ReactNode }) { const { colors } = useLuxTheme(); return <Text size={15} color={magazineRoles(colors).muted} style={useStyles().lead}>{children}</Text> }
function GateError({ children }: { children: ReactNode }) { const { colors } = useLuxTheme(); return <Text size={13} color={magazineRoles(colors).danger} accessibilityLiveRegion="polite">{children}</Text> }
function GateFootnote({ children }: { children: ReactNode }) { const { colors } = useLuxTheme(); return <Text size={11} color={magazineRoles(colors).eyebrow} style={[useStyles().footnote, { borderTopColor: magazineRoles(colors).hairline }]}>{children}</Text> }
function GateLinks({ children }: { children: ReactNode }) { return <View style={useStyles().links}>{children}</View> }
function GateNotice({ title, body }: { title: string, body: string }) { const { colors } = useLuxTheme(); const r = magazineRoles(colors); const styles = useStyles(); return <View style={[styles.notice, { borderTopColor: r.ink, borderBottomColor: r.hairline }]}><Text size={22} color={r.ink}>Ⅱ</Text><View style={styles.flex}><Text size={16} color={r.ink} style={styles.bold}>{title}</Text><Text size={12} color={r.muted}>{body}</Text></View></View> }
function GateSection({ title, meta, heading = false }: { title: string, meta?: string, heading?: boolean }) { const { colors } = useLuxTheme(); const r = magazineRoles(colors); const styles = useStyles(); return <View style={[styles.section, { borderTopColor: r.ink }]}><Text size={heading ? 22 : 11} color={heading ? r.ink : r.eyebrow} style={heading ? styles.bold : styles.eyebrow}>{title}</Text>{meta ? <Text size={11} color={heading ? r.eyebrow : r.accentInk} style={[styles.bold, !heading ? { backgroundColor: r.accentSoft, borderRadius: 14, minHeight: 28, paddingHorizontal: 8, paddingVertical: 6 } : null]}>{meta}</Text> : null}</View> }
function GateTabs({ provider, onChange }: { provider: LoginProvider, onChange: (provider: LoginProvider) => void }) { const t = useI18n(); return <TextTabs style={useStyles().tabs} value={provider} onChange={id => { onChange(id as LoginProvider) }} items={(['lux', 'lx', 'local'] as const).map(id => ({ id, label: t(`sync_login_tab_${id}`) }))} /> }
function GateWay({ index, title, subtitle, onPress }: { index: number, title: string, subtitle: string, onPress: () => void }) { const { colors } = useLuxTheme(); const r = magazineRoles(colors); const styles = useStyles(); return <TouchableOpacity accessibilityRole="button" onPress={onPress} style={[styles.way, { borderBottomColor: r.hairline }]}><Text size={15} color={r.quiet} style={styles.bold}>{index ? String(index).padStart(2, '0') : '+'}</Text><View style={styles.flex}><Text size={16} color={r.ink} style={styles.bold}>{title}</Text><Text size={12} color={r.muted}>{subtitle}</Text></View><Text size={22} color={r.quiet}>›</Text></TouchableOpacity> }
function RecentRow({ recent, name, large, onPress, action }: { recent: RecentLogin, name: string, large?: boolean, onPress: () => void, action?: ReactNode }) {
  const { colors } = useLuxTheme(); const r = magazineRoles(colors); const styles = useStyles(); const t = useI18n()
  return <View style={[styles.recent, !large && { borderBottomWidth: 1, borderBottomColor: r.hairline }]}><View style={[large ? styles.avatar : styles.avatarSmall, { borderColor: r.ink }]}><Text size={large ? 28 : 20} color={r.ink} style={styles.bold}>{recent.avatar.initial || 'L'}</Text></View><TouchableOpacity style={styles.flex} accessibilityRole="button" onPress={onPress}><Text size={large ? 22 : 16} color={r.ink} style={styles.bold} numberOfLines={1}>{name}</Text><Text size={12} color={r.muted} numberOfLines={1}>{t(`sync_login_tab_${recent.provider}`)}{recent.account ? ` · ${recent.account.username}` : ''}</Text><Text size={12} color={r.muted} numberOfLines={1}>{recent.server?.url.replace(/^https?:\/\//, '')}{recent.lastUsedAt ? ` · ${new Date(recent.lastUsedAt).toLocaleString()}` : t('sync_state_no_record')}</Text></TouchableOpacity>{action}</View>
}
function LocalDetails() { const t = useI18n(); const { colors } = useLuxTheme(); const r = magazineRoles(colors); const styles = useStyles(); return <><Text size={80} color={r.display} style={styles.local}>LOCAL<Text size={22} color={r.display}>/ 01</Text></Text><GateLead>{t('login_gate_local_library')}</GateLead>{([1, 2, 3] as const).map(index => <View key={index} style={[styles.localLine, { borderBottomColor: r.hairline }]}><Text size={12} color={r.eyebrow}>{`0${index}`}</Text><Text size={15} color={r.ink} style={styles.flex}>{t(`login_gate_local_${index}`)}</Text></View>)}<View style={styles.spacer} /></> }

const useStyles = sharedLuxStyles(() => createStyle({
  page: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 22, paddingBottom: 28 },
  top: { height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  title: { fontWeight: '800', letterSpacing: -1, lineHeight: 44, marginTop: 10 },
  eyebrow: { fontWeight: '700', letterSpacing: 2 },
  bold: { fontWeight: '700' },
  flex: { flex: 1 },
  lead: { lineHeight: 22, marginTop: 10, marginBottom: 4 },
  section: { borderTopWidth: 1, paddingTop: 12, marginTop: 24, marginBottom: 12, minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  recent: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, marginBottom: 6 },
  avatar: { width: 56, height: 56, borderRadius: 4, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  avatarSmall: { width: 40, height: 40, borderRadius: 4, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  links: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  way: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 18, borderBottomWidth: 1 },
  notice: { borderTopWidth: 1, borderBottomWidth: 1, marginTop: 14, paddingVertical: 12, flexDirection: 'row', gap: 14 },
  footnote: { marginTop: 40, paddingTop: 12, lineHeight: 17, borderTopWidth: 1 },
  tabs: { marginTop: 22, marginBottom: 18 },
  local: { fontWeight: '800', letterSpacing: -4, marginVertical: 22 },
  localLine: { minHeight: 50, flexDirection: 'row', gap: 14, alignItems: 'center', borderBottomWidth: 1 },
  spacer: { height: 24 },
  fieldInput: { minHeight: 44, fontWeight: '400' },
  languageTarget: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  fields: { gap: 18, marginTop: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1 },
  primary: { marginTop: 20 },
  hint: { lineHeight: 18, marginTop: 6 },
}))

function GateForm({ provider, intent, selected, busy, run, recents, onRecent, onHistory, historyHost, onHost, onRegister, onForgot, onOtherWays }: {
  provider: 'lux' | 'lx'
  intent?: LoginIntent | null
  selected: RecentLogin | null
  busy: boolean
  run: (action: () => Promise<void>) => Promise<void>
  recents: RecentLogin[]
  onRecent: (recent: RecentLogin) => void
  onHistory: () => void
  historyHost: string | null
  onHost: (host: string) => void
  onRegister: () => void
  onForgot: () => void
  onOtherWays: () => void
}) {
  const t = useI18n(); const { colors } = useLuxTheme(); const r = magazineRoles(colors); const styles = useStyles()
  const [host, setHost] = useState(selected?.server?.url ?? '')
  const [username, setUsername] = useState(selected?.account?.username ?? '')
  const [secret, setSecret] = useState(''); const [visible, setVisible] = useState(false)
  const [info, setInfo] = useState<ServerInfo | null>(null); const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    let active = true
    void loadSyncLoginFormSnapshot(provider).then(snapshot => {
      if (!active) return
      if (!selected) { const draft = gateDraft(provider, intent, snapshot); setHost(draft.host); setUsername(draft.username) }
      const draft = gateDraft(provider, intent, snapshot)
      setSaved(!selected && normalizeServerUrl(draft.host) === normalizeServerUrl(snapshot.host) && (provider === 'lx' ? snapshot.hasSavedLxKey : snapshot.hasSavedLuxSession))
      if (selected?.credentialRef) void getLoginCredentialAvailability(selected.credentialRef).then(value => { if (active) setSaved(value === 'available') })
      setReady(true)
    }).catch(err => { if (active) { setError(String(err.message)); setReady(true) } })
    return () => { active = false }
  }, [provider, selected, intent])
  useEffect(() => { if (historyHost !== null) setHost(historyHost) }, [historyHost])
  useEffect(() => { onHost(normalizeServerUrl(host)) }, [host, onHost])
  useEffect(() => {
    setInfo(null); setError('')
    if (!host.trim() || provider !== 'lux') return
    const controller = new AbortController()
    const timeout = setTimeout(() => { controller.abort(); setError(t('onboard_timeout')) }, 10500)
    const timer = setTimeout(() => {
      const url = normalizeServerUrl(host)
      if (!url) { clearTimeout(timeout); setError(t('onboard_invalid')); return }
      void fetch(`${url}/api/server-info`, { signal: controller.signal }).then(async response => {
        if (!response.ok) throw new Error(t('onboard_unreachable'))
        const server = parseServerInfo(await response.json())
        if (controller.signal.aborted) return
        if (server.minClientVersion && !versionAtLeast(process.versions.app, server.minClientVersion)) throw new Error(t('onboard_incompatible'))
        setInfo(server)
      }).catch(err => { if (!controller.signal.aborted) setError(String(err.message)) }).finally(() => { clearTimeout(timeout) })
    }, 500)
    return () => { controller.abort(); clearTimeout(timer); clearTimeout(timeout) }
  }, [host, provider, t])
  const submit = () => {
    void run(async() => {
      const url = normalizeServerUrl(host)
      if (!url) throw new Error(t('setting_sync_host_value_error_tip'))
      // LX's hello/id and code negotiation is owned by authenticateLxCandidate.
      // Lux must pass server-info compatibility validation before credential submission.
      if (provider === 'lux' && !info) throw new Error(error || t('onboard_checking'))
      if (provider === 'lux' && !username.trim()) throw new Error(t('setting_sync_lux_login_missing_tip'))
      await appSession.selectTarget({ targetProvider: provider, targetIdentity: selected && normalizeServerUrl(selected.server?.url ?? '') === url && (provider !== 'lux' || selected.account?.username === username.trim()) ? recentIdentity(selected) : undefined, targetRecentId: selected?.id, initialHost: url, initialUsername: username.trim() })
      try { await connectAppSession(provider, url, provider === 'lux' ? username.trim() : undefined, secret || undefined) } finally { setSecret('') }
      await rememberSyncLoginForm({ host: url, mode: provider, luxUsername: provider === 'lux' ? username.trim() : undefined })
    })
  }
  const secretLabel = t(provider === 'lux' ? 'auth_password' : 'setting_sync_code_label')
  return <>
    <View style={styles.fields}>
      <View><Text size={11} color={r.eyebrow} style={styles.bold}>{t('setting_sync_host_label')}</Text><View style={styles.inputRow}><View style={styles.input}><UnderlineInput value={host} onChangeText={value => { setHost(value); setSaved(false) }} editable={!busy && ready} autoCapitalize="none" autoCorrect={false} inputMode="url" autoFocus={intent?.reason === 'changeServer'} accessibilityLabel={t('setting_sync_host_label')} style={[styles.fieldInput, { borderBottomColor: r.ink }]} /></View><TextButton label={t('login_gate_history')} onPress={onHistory} disabled={busy} muted /></View>
      {/^http:\/\//i.test(host) ? <GateError>{t('onboard_http_warning')}</GateError> : null}
      {provider === 'lux' ? <Text size={12} color={r.muted} style={styles.hint} accessibilityLiveRegion="polite">{error || t(info ? info.registration.enabled ? 'login_gate_lux_registration_open' : 'onboard_registration_closed' : 'onboard_checking')}</Text> : null}</View>
      {provider === 'lux' ? <UnderlineInput label={t('auth_username')} value={username} onChangeText={value => { setUsername(value); setSaved(false) }} editable={!busy && ready} autoCapitalize="none" autoCorrect={false} style={{ minHeight: 44, fontWeight: '400', borderBottomColor: r.ink }} /> : null}
      <View><Text size={11} color={r.eyebrow} style={styles.bold}>{secretLabel}</Text><View style={styles.inputRow}><View style={styles.input}><UnderlineInput value={secret} onChangeText={setSecret} editable={!busy && ready} accessibilityLabel={secretLabel} autoFocus={provider === 'lx' && intent?.reason === 'reauth'} secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} style={{ minHeight: 44, fontWeight: '400', borderBottomColor: r.ink }} /></View><TextButton label={t(visible ? 'login_gate_hide' : 'login_gate_show')} onPress={() => { setVisible(!visible) }} muted /></View></View>
      {provider === 'lx' ? <Text size={12} color={r.muted} style={styles.hint}>{t(saved ? 'sync_login_lx_saved_hint' : 'sync_login_lx_code_hint')}</Text> : saved ? <Text size={12} color={r.muted}>{t('sync_login_lux_saved_hint')}</Text> : null}
    </View>
    <FocusVisibleAction><PrimaryButton style={styles.primary} label={t(busy ? 'sync_login_submitting' : provider === 'lux' ? intent?.reason === 'reauth' ? 'sync_state_relogin' : 'auth_login' : 'sync_login_lx_submit') + (busy ? '' : ' →')} disabled={busy || !ready} onPress={submit} /></FocusVisibleAction>
    {provider === 'lux' ? <GateLinks><TextButton label={t('auth_forgot_link')} onPress={onForgot} disabled={busy || !info} />{intent?.reason === 'reauth' ? <TextButton label={t('other_login_methods')} onPress={onOtherWays} disabled={busy} /> : info?.registration.enabled ? <TextButton label={t('auth_register_link')} onPress={onRegister} disabled={busy} /> : null}</GateLinks> : null}
    {recents.length ? <><GateSection title={t('login_gate_recent')} />{recents.filter(item => provider === 'lx' || normalizeServerUrl(item.server?.url ?? '') === normalizeServerUrl(host)).map(item => <RecentRow key={item.id} recent={item} name={item.account?.displayName ?? item.account?.username ?? t('login_gate_lx_name')} onPress={() => { if (!busy) onRecent(item) }} />)}</> : null}
  </>
}

function HostHistory({ onSelect, run }: { onSelect: (host: string) => void, run: (action: () => Promise<void>) => Promise<void> }) {
  const [hosts, setHosts] = useState<string[]>([]); const t = useI18n()
  const reload = async() => { setHosts([...(await getSyncHostHistory())]) }
  useEffect(() => { void reload() }, [])
  const remove = (index: number) => {
    void run(async() => {
      const host = hosts[index]
      const previous = appSession.pending?.previous
      const current = previous && previous.provider !== 'local' && normalizeServerUrl(previous.server.url) === normalizeServerUrl(host)
      if (current && !await confirmDialog({ title: t('login_gate_delete_current'), message: t('login_gate_delete_current_scope'), cancelButtonText: t('cancel'), confirmButtonText: t('remove_recent_only'), confirmDanger: true })) return
      // Already behind the Gate pause/disconnect barrier. Metadata removal keeps credentials/data.
      await removeSyncHostHistory(index)
      await reload()
    })
  }
  return <>{hosts.map((host, index) => <GateLinks key={host}><TextButton style={{ flex: 1 }} label={host} onPress={() => { onSelect(host) }} /><TextButton label={t('remove_recent_only')} danger onPress={() => { remove(index) }} /></GateLinks>)}</>
}

function GateLanguage() {
  const { colors } = useLuxTheme(); const r = magazineRoles(colors); const styles = useStyles()
  return <View style={{ flexDirection: 'row' }}>{([{ locale: 'zh_cn', label: '简' }, { locale: 'zh_tw', label: '繁' }, { locale: 'en_us', label: 'EN' }] as const).map(item => <TouchableOpacity key={item.locale} accessibilityRole="button" accessibilityLabel={item.label} accessibilityState={{ selected: global.i18n.locale === item.locale }} onPress={() => { setLanguage(item.locale) }} style={styles.languageTarget}><Text size={12} color={global.i18n.locale === item.locale ? r.ink : r.muted} style={{ textDecorationLine: global.i18n.locale === item.locale ? 'underline' : 'none' }}>{item.label}</Text></TouchableOpacity>)}</View>
}
