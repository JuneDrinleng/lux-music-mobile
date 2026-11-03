/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { FocusVisibleScrollView } from '@/components/common/FocusVisibleScrollView'
import { useEffect, useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native'
import { useSettingsBack } from '@/components/common/SettingsPage'
import Text from '@/components/common/Text'
import StatusBar from '@/components/common/StatusBar'
import { BackButton, PrimaryButton, Toggle, UnderlineInput } from '@/components/magazine'
import { useLuxTheme, sharedLuxStyles } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { createStyle, toast } from '@/utils/tools'
import { useStatusbarHeight } from '@/store/common/hook'
import useSystemGestureInsetBottom from '@/utils/hooks/useSystemGestureInsetBottom'
import { useI18n } from '@/lang'
import { requestJson } from '@/plugins/sync/client/auth'
import { findLuxAuthForHost, rotateLuxAuth } from '@/utils/data'
import { createPasswordService, passwordErrors, passwordErrorKey, sessionCountMessage, type PasswordForm } from '@/utils/changePassword'

const service = createPasswordService({ request: requestJson, find: findLuxAuthForHost, rotate: rotateLuxAuth })
const emptyForm: PasswordForm = { oldPassword: '', password: '', confirm: '' }

export default function ChangePassword({ host, session, onBack }: { host: string, session: LX.Sync.LuxAuth, onBack: () => void }) {
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const styles = useStyles()
  const t = useI18n()
  const statusHeight = useStatusbarHeight()
  const bottom = useSystemGestureInsetBottom()
  const [form, setForm] = useState(emptyForm)
  const [touched, setTouched] = useState<Partial<Record<keyof PasswordForm, boolean>>>({})
  const [revoke, setRevoke] = useState(true)
  const [count, setCount] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  const [wrongCurrent, setWrongCurrent] = useState(false)
  const [message, setMessage] = useState('')
  const back = () => { if (!submitting.current) onBack() }
  useSettingsBack(back)
  useEffect(() => {
    let active = true
    void service.count(host, session).then(value => { if (active) setCount(value) }).catch(() => {})
    return () => { active = false }
  }, [host, session])
  const errors = passwordErrors(form)
  const invalid = Object.values(errors).some(Boolean)
  const submit = async() => {
    if (submitting.current || invalid) return
    submitting.current = true
    setBusy(true)
    setMessage('')
    setWrongCurrent(false)
    try {
      await service.change(host, session, form, revoke)
      setForm(emptyForm)
      toast(t('password_success'))
      onBack()
    } catch (error) {
      const key = passwordErrorKey(error)
      if (key === 'password_current_invalid') setWrongCurrent(true)
      else setMessage(t(key))
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }
  const field = (key: keyof PasswordForm, label: string, hint?: string) => <View style={styles.field}>
    <Text size={12} color={r.muted} style={styles.bold}>{label}</Text>
    <UnderlineInput
      value={form[key]}
      accessibilityLabel={label}
      secureTextEntry
      autoCapitalize="none"
      autoCorrect={false}
      textContentType={key === 'oldPassword' ? 'password' : 'newPassword'}
      editable={!busy}
      onChangeText={value => {
        setForm(previous => ({ ...previous, [key]: value }))
        if (key === 'oldPassword') setWrongCurrent(false)
      }}
      onBlur={() => { setTouched(previous => ({ ...previous, [key]: true })) }}
      error={key === 'oldPassword' && wrongCurrent ? t('password_current_invalid') : touched[key] && errors[key] ? t(errors[key]) : undefined}
      style={[styles.input, { borderBottomColor: (key === 'oldPassword' && wrongCurrent) || (touched[key] && errors[key]) ? r.danger : r.ink }]}
    />
    {hint ? <Text size={12} color={r.muted} style={styles.hint}>{hint}</Text> : null}
  </View>
  const subtitle = sessionCountMessage(count)
  return <View style={StyleSheet.absoluteFillObject}><KeyboardAvoidingView style={[styles.page, { backgroundColor: r.paper, paddingTop: statusHeight }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <StatusBar />
    <FocusVisibleScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.top}><BackButton compact onPress={back} accessibilityLabel={t('back')} /></View>
      <Text size={11} color={r.eyebrow} style={styles.eyebrow}>{t('password_eyebrow')}</Text>
      <Text size={32} color={r.display} style={styles.title}>{t('password_title')}</Text>
      {field('oldPassword', t('password_current'))}
      {field('password', t('password_new'), t('auth_password_hint'))}
      {field('confirm', t('auth_confirm'))}
      <View style={styles.revokeRow}>
        <View style={styles.revokeText}>
          <Text size={15} color={r.list} style={styles.bold}>{t('password_revoke')}</Text>
          <Text size={12} color={r.muted} style={styles.subtitle}>{t(subtitle.key, subtitle.args)}</Text>
        </View>
        <Toggle compact value={revoke} onChange={setRevoke} disabled={busy} accessibilityLabel={t('password_revoke')} />
      </View>
      {message ? <Text size={12} color={r.danger} style={styles.hint} accessibilityLiveRegion="polite">{message}</Text> : null}
    </FocusVisibleScrollView>
    <View style={[styles.footer, { borderTopColor: r.ink, paddingBottom: 26 + bottom }]}>
      <PrimaryButton compact label={t('password_submit')} onPress={() => { void submit() }} disabled={busy || invalid} />
    </View>
  </KeyboardAvoidingView></View>
}

const useStyles = sharedLuxStyles(() => createStyle({
  page: { flex: 1 },
  content: { paddingHorizontal: 22, paddingBottom: 28 },
  top: { marginTop: 10, height: 40, justifyContent: 'center' },
  eyebrow: { marginTop: 6, fontWeight: '700', letterSpacing: 2 },
  title: { lineHeight: 38, fontWeight: '800' },
  field: { marginTop: 16 },
  bold: { fontWeight: '700' },
  input: { fontWeight: '400', borderBottomWidth: 1.5 },
  hint: { marginTop: 4 },
  revokeRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12 },
  revokeText: { flex: 1 },
  subtitle: { marginTop: 2 },
  footer: { borderTopWidth: 2, paddingHorizontal: 22, paddingTop: 12, paddingBottom: 26 },
}))
