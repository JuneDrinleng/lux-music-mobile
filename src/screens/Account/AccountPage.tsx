import { requestLogin } from '@/core/appSession'
/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { FocusVisibleScrollView } from '@/components/common/FocusVisibleScrollView'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { KeyboardAvoidingView, Platform, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import StatusBar from '@/components/common/StatusBar'
import { MdiIcon } from '@/components/common/MdiIcon'
import { BackButton, Rule, SecondaryButton } from '@/components/magazine'
import { useLuxTheme, sharedLuxStyles } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { createStyle, confirmDialog } from '@/utils/tools'
import { useStatusbarHeight } from '@/store/common/hook'
import useSystemGestureInsetBottom from '@/utils/hooks/useSystemGestureInsetBottom'
import { useI18n } from '@/lang'
import { requestJson } from '@/plugins/sync/client/auth'
import { captureProfileIdentity, type ProfileIdentity } from '@/plugins/sync/client/profile'
import { DEFAULT_USER_NAME, DEFAULT_USER_AVATAR, findLuxAuthForHost, getUserAvatar, getUserAvatarDataUrl, getUserName, getUserGender, getUserSignature } from '@/utils/data'
import { getActiveSpace, listSpaces } from '@/utils/dataSpace'
import { accountRows, createSessionService, relativeActivity, type AccountSession } from '@/utils/accountPage'
import { SettingsSubpage, useSettingsBack, useSettingsSubpage } from '@/components/common/SettingsPage'
import AccountSpaces from './AccountSpaces'
import AccountProfileSheet, { type ProfileField } from './AccountProfileSheet'
import ChangePassword from '@/screens/Login/ChangePassword'

export default function AccountPage({ host, lux, nickname, avatar, onBack, onLogout, onManageData }: {
  host: string
  lux: boolean
  nickname: string
  avatar: string | number | null
  onBack: () => void
  onManageData: () => void
  onLogout: () => Promise<void>
}) {
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const styles = useStyles()
  const t = useI18n()
  const statusHeight = useStatusbarHeight()
  const bottom = useSystemGestureInsetBottom()
  const { page, pages, setPage, style: pageStyle } = useSettingsSubpage<'account' | 'devices' | 'password' | 'spaces'>('account')
  const [session, setSession] = useState<LX.Sync.LuxAuth | null>(null)
  const [sessions, setSessions] = useState<AccountSession[] | null>(null)
  const [others, setOthers] = useState('')
  const [signature, setSignature] = useState('')
  const [gender, setGender] = useState<LX.Sync.LuxProfile['gender']>('unknown')
  const [profileName, setProfileName] = useState(nickname)
  const [profileAvatar, setProfileAvatar] = useState(avatar)
  const [editor, setEditor] = useState<{ field: ProfileField, initialValue: string, identity: ProfileIdentity } | null>(null)
  const [editorVisible, setEditorVisible] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const space = useRef(getActiveSpace()).current
  const server = lux && space !== 'local'
  const rows = accountRows(server)
  const service = session ? createSessionService(requestJson, host, session.token) : null
  const back = () => {
    if (pending.current) return
    setMessage('')
    if (page === 'account') onBack()
    else setPage('account')
  }
  useSettingsBack(back)
  const refreshProfile = useCallback(async() => {
    const identity = captureProfileIdentity()
    const [name, currentAvatar, currentSignature, currentGender] = await Promise.all([getUserName(), getUserAvatar(), getUserSignature(), getUserGender()])
    if (identity.space !== getActiveSpace() || identity.generation !== captureProfileIdentity().generation) return
    setProfileName(name ?? DEFAULT_USER_NAME)
    setProfileAvatar(currentAvatar ?? DEFAULT_USER_AVATAR)
    setSignature(currentSignature ?? '')
    setGender(currentGender)
  }, [])
  useEffect(() => {
    let active = true
    void listSpaces().then(spaces => {
      if (active) setOthers(spaces.filter(item => item.id !== space).map(item => item.kind === 'local' ? t('account_local') : item.label ?? item.id).join(t('account_list_separator')))
    }).catch(() => { if (active) setOthers(t('account_spaces_failed')) })
    void refreshProfile().catch(() => { if (active) setMessage(t('account_profile_load_failed')) })
    if (server) {
      void findLuxAuthForHost(host).then(async auth => {
        if (!active) return
        setSession(auth)
        if (!auth) throw new Error('Session unavailable')
        const list = await createSessionService(requestJson, host, auth.token).list()
        if (active) setSessions(list)
      }).catch(() => { if (active) setMessage(t('account_devices_failed')) })
    }
    return () => { active = false }
  }, [host, server, space, t, refreshProfile])
  useEffect(() => {
    const nameUpdated = (value: string) => { setProfileName(value.trim() ? value : DEFAULT_USER_NAME) }
    const avatarUpdated = (value: string | null) => { setProfileAvatar(value ?? DEFAULT_USER_AVATAR) }
    const signatureUpdated = (value: string) => { setSignature(value) }
    const genderUpdated = (value: LX.Sync.LuxProfile['gender']) => { setGender(value) }
    global.app_event.on('userNameUpdated', nameUpdated)
    global.app_event.on('userAvatarUpdated', avatarUpdated)
    global.app_event.on('userSignatureUpdated', signatureUpdated)
    global.app_event.on('userGenderUpdated', genderUpdated)
    return () => {
      global.app_event.off('userNameUpdated', nameUpdated)
      global.app_event.off('userAvatarUpdated', avatarUpdated)
      global.app_event.off('userSignatureUpdated', signatureUpdated)
      global.app_event.off('userGenderUpdated', genderUpdated)
    }
  }, [])
  const refreshSessions = async() => {
    const auth = await findLuxAuthForHost(host)
    if (!auth) throw new Error('Session unavailable')
    setSession(auth)
    setSessions(await createSessionService(requestJson, host, auth.token).list())
  }
  const run = async(action: () => Promise<void>, errorKey: 'account_save_failed' | 'account_devices_failed' | 'account_logout_failed' = 'account_devices_failed') => {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setMessage('')
    try { await action() } catch { setMessage(t(errorKey)) } finally { pending.current = false; setBusy(false) }
  }
  const openProfile = (field: ProfileField) => {
    if (editorVisible) return
    void run(async() => {
      const identity = captureProfileIdentity()
      const initialValue = field === 'avatar' ? await getUserAvatarDataUrl() ?? ''
        : field === 'displayName' ? await getUserName() ?? DEFAULT_USER_NAME
          : field === 'signature' ? await getUserSignature() ?? '' : await getUserGender()
      if (identity.space !== getActiveSpace() || identity.generation !== captureProfileIdentity().generation) throw new Error('Profile account changed')
      setEditor({ field, initialValue, identity })
      setEditorVisible(true)
    }, 'account_save_failed')
  }
  const mutateSessions = (id?: string) => {
    void run(async() => {
      if (!service) throw new Error('Session unavailable')
      const confirmed = await confirmDialog({ title: t(id ? 'account_remove_title' : 'account_revoke_title'), message: t('account_revoke_message'), cancelButtonText: t('cancel'), confirmButtonText: t(id ? 'account_remove' : 'account_revoke'), confirmDanger: true })
      if (confirmed) setSessions(id ? await service.remove(id) : await service.revokeOthers())
    })
  }
  const avatarThumbnail = <View style={[styles.avatarThumbnail, { backgroundColor: r.accentSoft }]}>
    {profileAvatar ? <Image url={profileAvatar} style={styles.avatarThumbnail} resizeMode="cover" /> : <Text size={16} color={r.ink} style={styles.heavy}>{profileName.slice(0, 1).toUpperCase()}</Text>}
  </View>
  const section = (title: string, count?: string, accountLayout = false) => <><Rule gapTop={22} style={{ height: accountLayout ? 1 : 2, opacity: 1 }} /><View style={[styles.section, accountLayout ? styles.switchSection : null]}><Text size={22} color={r.ink} style={[styles.heavy, accountLayout ? styles.sectionTitle : null]}>{title}</Text>{count ? <Text size={12} color={r.muted} style={styles.bold}>{count}</Text> : null}</View></>
  const row = (title: string, subtitle: string | undefined, onPress: () => void, thumb?: ReactNode, last = false, accountLayout = false) => <TouchableOpacity activeOpacity={0.7} accessibilityRole="button" onPress={onPress} style={[styles.row, accountLayout ? styles.profileRow : null, { borderBottomColor: r.hairline, borderBottomWidth: last ? 0 : 1 }]}>
    <View style={styles.flex}><Text size={accountLayout ? 16 : 15} color={r.list} style={[styles.bold, accountLayout ? styles.rowTitle : null]}>{title}</Text>{subtitle ? <Text size={12} color={r.muted} style={[styles.subtitle, accountLayout ? styles.meta : null]}>{subtitle}</Text> : null}</View>{thumb}<MdiIcon name="chevron-right" size={18} color={accountLayout ? r.quiet : r.ink} />
  </TouchableOpacity>
  const profileRow = (field: ProfileField, title: string, subtitle: string, last = false) => <TouchableOpacity activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={t('account_edit_field', { field: title })} accessibilityHint={subtitle} disabled={busy} onPress={() => { openProfile(field) }} style={[styles.profileRow, { borderBottomColor: r.hairline, borderBottomWidth: last ? 0 : 1 }]}>
    <View style={styles.flex}><Text size={16} color={r.list} style={[styles.bold, styles.rowTitle]}>{title}</Text><Text size={12} color={r.muted} style={[styles.subtitle, styles.meta]} numberOfLines={1}>{subtitle}</Text></View>
    {field === 'avatar' ? avatarThumbnail : null}<MdiIcon name="chevron-right" size={18} color={r.quiet} />
  </TouchableOpacity>
  const renderPage = (page: typeof pages[number]) => {
    const eyebrow = page === 'spaces' ? 'spaces_eyebrow' : page === 'devices' ? 'account_devices_eyebrow' : 'account_eyebrow'
    return <KeyboardAvoidingView style={[styles.page, { backgroundColor: r.paper, paddingTop: statusHeight }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <StatusBar />
    <FocusVisibleScrollView contentContainerStyle={[styles.content, { paddingBottom: 28 + bottom }]} keyboardShouldPersistTaps="handled">
      <View style={styles.top}><BackButton compact onPress={back} accessibilityLabel={t('back')} /></View>
      <Text size={11} color={r.eyebrow} style={styles.eyebrow}>{t(eyebrow)}</Text>
      {page === 'account' ? <>
        <Text size={32} color={r.display} style={[styles.title, styles.accountTitle]}>{t('account_title')}</Text>
        <Text size={12} color={r.muted} style={[styles.identity, styles.meta]} accessibilityHint={t(server ? 'account_username_hint' : 'account_local_username_hint')}>{server ? `${session?.user.username ?? ''} · ${host.replace(/^https?:\/\//, '').replace(/\/+$/, '')} · ${t(session?.user.role === 'admin' ? 'account_admin' : 'account_member')}` : t(lux || !host ? 'account_local_identity' : 'account_lx_identity')}</Text>
        {server ? <Text size={12} color={r.muted} style={styles.hint}>{t('account_username_hint')}</Text> : null}
        <View>
          <Rule gapTop={22} />
          <Text size={22} color={r.ink} style={[styles.heavy, styles.profileSection]}>{t('account_profile')}</Text>
          {profileRow('avatar', t('account_avatar'), t(server ? 'account_avatar_synced' : 'account_avatar_local'))}
          {profileRow('displayName', t('account_nickname'), t('account_nickname_value', { name: profileName }))}
          {profileRow('signature', t('setting_profile_signature'), signature || t('me_profile_status'))}
          {profileRow('gender', t('setting_profile_gender'), t(`setting_profile_gender_${gender}`), true)}
        </View>
        {server ? <>{section(t('account_security'))}{row(t('account_devices'), sessions ? t('account_devices_count', { count: sessions.length }) : t('account_count_unknown'), () => {
          setMessage(''); setPage('devices')
          void run(async() => {
            const auth = await findLuxAuthForHost(host)
            if (!auth) throw new Error('Session unavailable')
            setSession(auth)
            setSessions(await createSessionService(requestJson, host, auth.token).list())
          })
        })}{row(t('password_title'), undefined, () => { if (session) { setMessage(''); setPage('password') } })}</> : null}
        {section(t('account_switch_section'), undefined, true)}
        {row(t('spaces_title'), undefined, () => { setPage('spaces') }, undefined, false, true)}
        {row(t('account_switch'), t('account_other_spaces', { names: others || t('account_none') }), () => { void requestLogin({ reason: 'switch', source: 'E06-account', returnPolicy: 'restorePrevious' }) }, undefined, true, true)}
        {rows.includes('logout') ? <View style={styles.logout}><SecondaryButton compact danger label={t('account_logout')} onPress={() => { void run(onLogout, 'account_logout_failed') }} disabled={busy} style={styles.button} /></View> : null}
      </> : page === 'spaces' ? <AccountSpaces onManageData={onManageData} /> : page === 'devices' ? <>
        <Text size={32} color={r.display} style={styles.title}>{t('account_devices')}</Text>
        <Text size={12} color={r.muted} style={styles.hint}>{t('account_devices_subtitle')}</Text>
        {section(t('account_logged_in'), sessions ? t('account_session_count', { count: sessions.length }) : t('account_count_unknown'))}
        {sessions?.map(item => {
          const activity = relativeActivity(item.lastActiveAt)
          return <View key={item.id} style={[styles.row, styles.deviceRow, { borderBottomColor: r.hairline }]}>
            <View style={[styles.deviceIcon, { backgroundColor: colors.surface.placeholder }]}><MdiIcon name="devices" size={18} color={r.ink} /></View>
            <View style={styles.flex}><Text size={15} color={r.list} style={styles.bold}>{item.deviceName}{item.current ? t('account_this_device') : ''}</Text><Text size={12} color={r.muted} style={styles.subtitle}>{item.platform} • {t(activity.key, activity.args)}</Text></View>
            {item.current ? <Text size={12} color={r.muted} style={styles.bold}>{t('account_current')}</Text> : <SecondaryButton compact danger label={t('account_remove')} onPress={() => { mutateSessions(item.id) }} disabled={busy} style={styles.button} />}
          </View>
        })}
        <View style={[styles.field, { alignItems: 'flex-start' }]}><SecondaryButton compact label={t('account_revoke')} onPress={() => { mutateSessions() }} disabled={busy || !service} style={styles.button} /></View>
      </> : null}
      {message ? <Text size={12} color={r.danger} style={styles.field} accessibilityLiveRegion="polite">{message}</Text> : null}
    </FocusVisibleScrollView>
    {page === 'password' && session ? <ChangePassword host={host.replace(/\/+$/, '')} session={session} onBack={() => { setPage('account'); void run(refreshSessions) }} /> : null}
  </KeyboardAvoidingView>
  }
  return <>
    <SettingsSubpage pages={pages} style={pageStyle}>{renderPage}</SettingsSubpage>
    {editor ? <AccountProfileSheet {...editor} visible={editorVisible} server={server} nickname={profileName} onClose={() => { setEditorVisible(false) }} onSaved={refreshProfile} /> : null}
  </>
}

const useStyles = sharedLuxStyles(() => createStyle({
  page: { flex: 1 },
  content: { paddingHorizontal: 22 },
  top: { marginTop: 10, height: 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { marginTop: 6, lineHeight: 14, fontWeight: '700', letterSpacing: 2 },
  title: { lineHeight: 38, fontWeight: '800' },
  heavy: { fontWeight: '800' },
  bold: { fontWeight: '700' },
  flex: { flex: 1, minWidth: 0 },
  accountTitle: { marginTop: 6, letterSpacing: -0.8 },
  identity: { marginTop: 8 },
  meta: { lineHeight: 16 },
  switchSection: { marginBottom: 6 },
  sectionTitle: { lineHeight: 28, letterSpacing: -0.3 },
  profileSection: { marginTop: 12, marginBottom: 6, lineHeight: 28, letterSpacing: -0.3 },
  profileRow: { minHeight: 62, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowTitle: { lineHeight: 22 },
  avatarThumbnail: { width: 40, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  section: { marginTop: 12, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1 },
  subtitle: { marginTop: 2 },
  button: { paddingHorizontal: 14 },
  logout: { marginTop: 18, alignItems: 'flex-start' },
  field: { marginTop: 16 },
  hint: { marginTop: 4 },
  deviceRow: { minHeight: 62 },
  deviceIcon: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
}))
