/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { FocusVisibleScrollView } from '@/components/common/FocusVisibleScrollView'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Animated, KeyboardAvoidingView, Platform, TouchableOpacity, View } from 'react-native'
import ImagePicker from 'react-native-image-crop-picker'
import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import StatusBar from '@/components/common/StatusBar'
import { MdiIcon } from '@/components/common/MdiIcon'
import { BackButton, OptionRow, Rule, PrimaryButton, SecondaryButton, UnderlineInput } from '@/components/magazine'
import { useLuxTheme, sharedLuxStyles } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { createStyle, confirmDialog } from '@/utils/tools'
import { useStatusbarHeight } from '@/store/common/hook'
import useSystemGestureInsetBottom from '@/utils/hooks/useSystemGestureInsetBottom'
import { useI18n } from '@/lang'
import { requestJson } from '@/plugins/sync/client/auth'
import { saveEditedProfile } from '@/plugins/sync/client/profile'
import { findLuxAuthForHost, getUserAvatarDataUrl, getUserGender, getUserSignature } from '@/utils/data'
import { getActiveSpace, listSpaces } from '@/utils/dataSpace'
import { accountRows, createSessionService, relativeActivity, type AccountSession } from '@/utils/accountPage'
import { useSettingsBack, useSettingsSubpage } from '@/components/common/SettingsPage'
import AccountSpaces from './AccountSpaces'
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
  const { page, setPage, style: pageStyle } = useSettingsSubpage<'account' | 'edit' | 'devices' | 'password' | 'spaces'>('account')
  const [session, setSession] = useState<LX.Sync.LuxAuth | null>(null)
  const [sessions, setSessions] = useState<AccountSession[] | null>(null)
  const [others, setOthers] = useState('')
  const [draft, setDraft] = useState(nickname)
  const [draftSignature, setDraftSignature] = useState('')
  const [draftGender, setDraftGender] = useState<LX.Sync.LuxProfile['gender']>('unknown')
  const [draftAvatar, setDraftAvatar] = useState<string | null>(null)
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
  useEffect(() => {
    let active = true
    void listSpaces().then(spaces => {
      if (active) setOthers(spaces.filter(item => item.id !== space).map(item => item.kind === 'local' ? t('account_local') : item.label ?? item.id).join(t('account_list_separator')))
    }).catch(() => { if (active) setOthers(t('account_spaces_failed')) })
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
  }, [host, server, space, t])
  const refreshSessions = async() => {
    const auth = await findLuxAuthForHost(host)
    if (!auth) throw new Error('Session unavailable')
    setSession(auth)
    setSessions(await createSessionService(requestJson, host, auth.token).list())
  }
  const run = async(action: () => Promise<void>, errorKey: 'account_save_failed' | 'account_devices_failed' | 'account_logout_failed' = page === 'edit' ? 'account_save_failed' : 'account_devices_failed') => {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setMessage('')
    try { await action() } catch { setMessage(t(errorKey)) } finally { pending.current = false; setBusy(false) }
  }
  const edit = () => {
    void run(async() => {
      if (server) {
        const auth = await findLuxAuthForHost(host)
        if (!auth) throw new Error('Session unavailable')
        setSession(auth)
      }
      const [currentAvatar, signature, gender] = await Promise.all([getUserAvatarDataUrl(), getUserSignature(), getUserGender()])
      setDraft(nickname)
      setDraftSignature(signature ?? '')
      setDraftGender(gender)
      setDraftAvatar(currentAvatar)
      setPage('edit')
    })
  }
  const save = () => {
    void run(async() => {
      const signature = draftSignature.trim().substring(0, 140)
      await saveEditedProfile({ displayName: draft.trim(), avatar: draftAvatar ?? '', gender: draftGender, signature: signature === t('me_profile_status') ? '' : signature }, server)
      setPage('account')
    })
  }
  const pickAvatar = () => {
    void run(async() => {
      try {
        const image = await ImagePicker.openPicker({ width: 400, height: 400, cropping: true, cropperCircleOverlay: true, mediaType: 'photo', includeBase64: true })
        if (!image.data) throw new Error('Avatar unavailable')
        setDraftAvatar(`data:${image.mime};base64,${image.data}`)
      } catch (error) {
        if ((error as { code?: string }).code !== 'E_PICKER_CANCELLED') throw error
      }
    })
  }
  const mutateSessions = (id?: string) => {
    void run(async() => {
      if (!service) throw new Error('Session unavailable')
      const confirmed = await confirmDialog({ title: t(id ? 'account_remove_title' : 'account_revoke_title'), message: t('account_revoke_message'), cancelButtonText: t('cancel'), confirmButtonText: t(id ? 'account_remove' : 'account_revoke'), confirmDanger: true })
      if (confirmed) setSessions(id ? await service.remove(id) : await service.revokeOthers())
    })
  }
  const avatarCircle = (size: number, url: string | number | null, name: string) => <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: r.accentSoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
    {url ? <Image url={url} style={{ width: size, height: size, borderRadius: size / 2 }} resizeMode="cover" /> : <Text size={size === 96 ? 40 : size === 72 ? 30 : 13} color={r.ink} style={styles.heavy}>{name.slice(0, 1).toUpperCase()}</Text>}
  </View>
  const section = (title: string, count?: string) => <><Rule gapTop={22} style={{ height: 2, opacity: 1 }} /><View style={styles.section}><Text size={22} color={r.ink} style={styles.heavy}>{title}</Text>{count ? <Text size={12} color={r.muted} style={styles.bold}>{count}</Text> : null}</View></>
  const row = (title: string, subtitle: string | undefined, onPress: () => void, thumb?: ReactNode) => <TouchableOpacity activeOpacity={0.7} accessibilityRole="button" onPress={onPress} style={[styles.row, { borderBottomColor: r.hairline }]}>
    <View style={styles.flex}><Text size={15} color={r.list} style={styles.bold}>{title}</Text>{subtitle ? <Text size={12} color={r.muted} style={styles.subtitle}>{subtitle}</Text> : null}</View>{thumb}<MdiIcon name="chevron-right" size={18} color={r.ink} />
  </TouchableOpacity>
  const field = (label: string, value: string, hint: string, readOnly = false, onChangeText = setDraft, maxLength?: number) => <View style={styles.field}>
    <Text size={12} color={r.muted} style={styles.bold}>{label}</Text>
    <UnderlineInput accessibilityLabel={label} value={value} onChangeText={onChangeText} maxLength={maxLength} editable={!readOnly && !busy} autoCorrect={false} style={{ fontWeight: '400', borderBottomWidth: 1.5, borderBottomColor: r.ink }} />
    <Text size={12} color={r.muted} style={styles.hint}>{hint}</Text>
  </View>
  const eyebrow = page === 'spaces' ? 'spaces_eyebrow' : page === 'edit' ? 'account_edit_eyebrow' : page === 'devices' ? 'account_devices_eyebrow' : 'account_eyebrow'
  return <Animated.View style={[{ flex: 1 }, pageStyle]}><KeyboardAvoidingView style={[styles.page, { backgroundColor: r.paper, paddingTop: statusHeight }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <StatusBar />
    <FocusVisibleScrollView contentContainerStyle={[styles.content, { paddingBottom: 28 + bottom }]} keyboardShouldPersistTaps="handled">
      <View style={styles.top}><BackButton compact onPress={back} accessibilityLabel={t('back')} /></View>
      <Text size={11} color={r.eyebrow} style={styles.eyebrow}>{t(eyebrow)}</Text>
      {page === 'account' ? <>
        <View style={styles.hero}>{avatarCircle(72, avatar, nickname)}<View style={styles.flex}><Text size={28} color={r.display} style={[styles.heavy, styles.name]}>{nickname}</Text><Text size={12} color={r.muted}>{server ? `${session?.user.username ?? ''} • ${host.replace(/^https?:\/\//, '').replace(/\/+$/, '')} • ${t(session?.user.role === 'admin' ? 'account_admin' : 'account_member')}` : t('account_local')}</Text></View><SecondaryButton compact label={t('account_edit')} onPress={edit} disabled={busy} style={styles.button} /></View>
        {section(t('account_profile'))}
        {row(t('account_nickname'), t('account_nickname_value', { name: nickname }), edit)}
        {row(t('account_avatar'), t(server ? 'account_avatar_synced' : 'account_avatar_local'), edit, avatarCircle(32, avatar, nickname))}
        {server ? <>{section(t('account_security'))}{row(t('account_devices'), sessions ? t('account_devices_count', { count: sessions.length }) : t('account_count_unknown'), () => {
          setMessage(''); setPage('devices')
          void run(async() => {
            const auth = await findLuxAuthForHost(host)
            if (!auth) throw new Error('Session unavailable')
            setSession(auth)
            setSessions(await createSessionService(requestJson, host, auth.token).list())
          })
        })}{row(t('password_title'), undefined, () => { if (session) { setMessage(''); setPage('password') } })}</> : null}
        {section(t('account_switch_section'))}
        {row(t('account_switch'), t('account_other_spaces', { names: others || t('account_none') }), () => { setMessage(''); setPage('spaces') })}
        {rows.includes('logout') ? <View style={styles.logout}><SecondaryButton compact danger label={t('account_logout')} onPress={() => { void run(onLogout, 'account_logout_failed') }} disabled={busy} style={styles.button} /></View> : null}
      </> : page === 'spaces' ? <AccountSpaces onManageData={onManageData} /> : page === 'edit' ? <>
        <Text size={32} color={r.display} style={styles.title}>{t('account_edit_title')}</Text>
        <View style={styles.avatar}>{avatarCircle(96, draftAvatar, draft)}</View>
        <View style={styles.pick}><SecondaryButton compact label={t('account_change_avatar')} onPress={pickAvatar} disabled={busy} style={{ paddingHorizontal: 14 }} /></View>
        {field(t('account_nickname'), draft, t('account_nickname_hint'))}
        {field(t('auth_username'), server ? session?.user.username ?? '' : t('account_local'), t(server ? 'account_username_hint' : 'account_local_username_hint'), true)}
        {field(t('setting_profile_signature'), draftSignature, t('setting_profile_signature_placeholder'), false, setDraftSignature, 140)}
        <View style={styles.field}>
          <Text size={12} color={r.muted} style={styles.bold}>{t('setting_profile_gender')}</Text>
          {(['male', 'female', 'unknown'] as const).map(value => <OptionRow key={value} leading compact disabled={busy} label={t(`setting_profile_gender_${value}`)} selected={draftGender === value} onPress={() => { setDraftGender(value) }} />)}
        </View>
        <Text size={12} color={r.muted} style={styles.field}>{t(server ? 'account_save_note' : 'account_save_local_note')}</Text>
      </> : page === 'devices' ? <>
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
    {page === 'edit' ? <View style={[styles.footer, { borderTopColor: r.ink, paddingBottom: 26 + bottom }]}><PrimaryButton compact label={t('account_save')} onPress={save} disabled={busy} /></View> : null}
    {page === 'password' && session ? <ChangePassword host={host.replace(/\/+$/, '')} session={session} onBack={() => { setPage('account'); void run(refreshSessions) }} /> : null}
  </KeyboardAvoidingView></Animated.View>
}

const useStyles = sharedLuxStyles(() => createStyle({
  page: { flex: 1 },
  footer: { borderTopWidth: 2, paddingHorizontal: 22, paddingTop: 12 },
  content: { paddingHorizontal: 22 },
  top: { marginTop: 10, height: 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { marginTop: 6, fontWeight: '700', letterSpacing: 2 },
  title: { lineHeight: 38, fontWeight: '800' },
  heavy: { fontWeight: '800' },
  bold: { fontWeight: '700' },
  flex: { flex: 1, minWidth: 0 },
  hero: { flexDirection: 'row', gap: 16, alignItems: 'center', marginTop: 10 },
  name: { lineHeight: 38 },
  section: { marginTop: 12, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1 },
  subtitle: { marginTop: 2 },
  button: { paddingHorizontal: 14 },
  logout: { marginTop: 18, alignItems: 'flex-start' },
  field: { marginTop: 16 },
  hint: { marginTop: 4 },
  avatar: { alignItems: 'center', marginTop: 20 },
  pick: { alignItems: 'center', marginTop: 10 },
  deviceRow: { minHeight: 62 },
  deviceIcon: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
}))
