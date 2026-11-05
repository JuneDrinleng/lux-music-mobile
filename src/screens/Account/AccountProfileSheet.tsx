/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Keyboard, TouchableOpacity, View, useWindowDimensions } from 'react-native'
import ImagePicker from 'react-native-image-crop-picker'
import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import { FocusVisibleAction, FocusVisibleScrollView } from '@/components/common/FocusVisibleScrollView'
import { MagazineSheet, OptionRow, SecondaryButton, UnderlineInput } from '@/components/magazine'
import { useI18n } from '@/lang'
import { saveEditedProfileField, type ProfileIdentity } from '@/plugins/sync/client/profile'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { confirmDialog, createStyle } from '@/utils/tools'

export type ProfileField = keyof LX.Sync.LuxProfile

export default function AccountProfileSheet({ visible, field, initialValue, identity, server, nickname, onClose, onSaved }: {
  visible: boolean
  field: ProfileField
  initialValue: string
  identity: ProfileIdentity
  server: boolean
  nickname: string
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const styles = useStyles()
  const t = useI18n()
  const { height } = useWindowDimensions()
  const [draft, setDraft] = useState(initialValue)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const confirming = useRef(false)
  const keyboardVisible = useRef(false)
  const active = useRef(visible)
  active.current = visible
  useEffect(() => {
    if (!visible) return
    active.current = true
    setDraft(initialValue)
    setMessage('')
    const shown = Keyboard.addListener('keyboardDidShow', () => { keyboardVisible.current = true })
    const hidden = Keyboard.addListener('keyboardDidHide', () => { keyboardVisible.current = false })
    return () => { active.current = false; keyboardVisible.current = false; shown.remove(); hidden.remove() }
  }, [visible, field, initialValue])

  const normalized = (value: string) => field === 'signature' ? value.trim().substring(0, 140) === t('me_profile_status') ? '' : value.trim().substring(0, 140) : field === 'displayName' ? value.trim() : value
  const dirty = normalized(draft) !== normalized(initialValue)
  const label = t(field === 'avatar' ? 'account_avatar' : field === 'displayName' ? 'account_nickname' : field === 'signature' ? 'setting_profile_signature' : 'setting_profile_gender')
  const title = t(field === 'avatar' ? 'account_edit_avatar' : field === 'displayName' ? 'account_edit_nickname' : field === 'signature' ? 'setting_profile_signature_edit' : 'account_edit_gender')
  const close = () => {
    if (pending.current || confirming.current) return
    if (keyboardVisible.current || Keyboard.isVisible()) { Keyboard.dismiss(); return }
    if (!dirty) { onClose(); return }
    confirming.current = true
    void confirmDialog({ title: t('account_discard_title'), message: t('account_discard_message'), cancelButtonText: t('cancel'), confirmButtonText: t('account_discard'), confirmDanger: true }).then(confirmed => {
      if (confirmed && active.current) onClose()
    }).finally(() => { confirming.current = false })
  }
  const save = () => {
    if (!dirty || pending.current || confirming.current) return
    pending.current = true
    setBusy(true)
    setMessage('')
    void (async() => {
      try {
        const value = normalized(draft)
        if (field === 'gender') {
          if (value !== 'male' && value !== 'female' && value !== 'unknown') throw new Error('Invalid gender')
          await saveEditedProfileField(field, value, server, identity)
        } else await saveEditedProfileField(field, value, server, identity)
        if (!active.current) return
        await onSaved()
        Keyboard.dismiss()
        onClose()
      } catch {
        if (active.current) setMessage(t('account_save_failed'))
      } finally { pending.current = false; setBusy(false) }
    })()
  }
  const pickAvatar = () => {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setMessage('')
    void ImagePicker.openPicker({ width: 400, height: 400, cropping: true, cropperCircleOverlay: true, mediaType: 'photo', includeBase64: true }).then(image => {
      if (!image.data) throw new Error('Avatar unavailable')
      if (active.current) setDraft(`data:${image.mime};base64,${image.data}`)
    }).catch(error => {
      if (active.current && (error as { code?: string }).code !== 'E_PICKER_CANCELLED') setMessage(t('account_avatar_failed'))
    }).finally(() => { pending.current = false; setBusy(false) })
  }

  return <MagazineSheet profileLayout visible={visible} onClose={close} closeDisabled={busy} heightRatio={Math.min(1, styles.preferredPanel.height / height)} eyebrow={t('account_edit_eyebrow')} title={title} footerContent={<View />}>
    <FocusVisibleScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <View style={styles.field}>
        {field === 'avatar' ? <View style={styles.avatarRow}>
          <View style={[styles.avatar, { backgroundColor: r.accentSoft }]}>{draft ? <Image url={draft} style={styles.avatar} resizeMode="cover" /> : <Text size={28} color={r.ink} style={styles.bold}>{nickname.slice(0, 1).toUpperCase()}</Text>}</View>
          <SecondaryButton label={t('account_change_avatar')} disabled={busy} onPress={pickAvatar} />
        </View> : <>
          <Text size={12} color={r.muted} style={[styles.bold, styles.meta]}>{label}</Text>
          {field === 'gender' ? (['male', 'female', 'unknown'] as const).map(value => <OptionRow key={value} leading compact disabled={busy} label={t(`setting_profile_gender_${value}`)} selected={draft === value} onPress={() => { setDraft(value) }} />) : <UnderlineInput accessibilityLabel={label} value={draft} onChangeText={setDraft} maxLength={field === 'signature' ? 140 : undefined} multiline={field === 'signature'} editable={!busy} autoCorrect={false} placeholder={field === 'signature' ? t('setting_profile_signature_placeholder') : undefined} style={[styles.input, { borderBottomColor: r.ink }, field === 'signature' ? styles.signature : null]} />}
        </>}
        <View style={styles.metaRow}>
          <Text size={12} color={r.muted} style={[styles.meta, styles.scope]}>{t(server ? 'account_save_note' : 'account_save_local_note')}</Text>
          {field === 'signature' ? <Text size={12} color={r.muted} style={styles.meta}>{t('account_signature_count', { count: draft.length })}</Text> : null}
        </View>
        {field === 'displayName' ? <Text size={12} color={r.muted} style={styles.hint}>{t('account_nickname_hint')}</Text> : null}
        {message ? <Text size={12} color={r.danger} style={styles.hint} accessibilityLiveRegion="polite">{message}</Text> : null}
      </View>
      <FocusVisibleAction style={[styles.actions, { borderTopColor: r.ink }]}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('cancel')} accessibilityState={{ disabled: busy }} activeOpacity={0.7} disabled={busy} onPress={close} style={styles.cancel}><Text size={14} color={r.ink}>{t('cancel')}</Text></TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('account_save')} accessibilityState={{ disabled: !dirty || busy, busy }} activeOpacity={0.7} disabled={!dirty || busy} onPress={save} style={[styles.save, { backgroundColor: !dirty || busy ? r.hairline : r.ink }]}>
          {busy ? <ActivityIndicator size="small" color={r.muted} /> : null}<Text size={15} color={!dirty || busy ? r.muted : r.onInk} style={styles.bold}>{t(busy ? 'account_saving' : 'account_save')}</Text>
        </TouchableOpacity>
      </FocusVisibleAction>
    </FocusVisibleScrollView>
  </MagazineSheet>
}

const useStyles = sharedLuxStyles(() => createStyle({
  preferredPanel: { height: 348 },
  content: { flexGrow: 1, paddingBottom: 28 },
  field: { marginTop: 16 },
  bold: { fontWeight: '700' },
  meta: { lineHeight: 16 },
  scope: { flex: 1 },
  input: { marginTop: 6, minHeight: 44, fontSize: 16, lineHeight: 22, paddingTop: 7, paddingBottom: 9, fontWeight: '400', borderBottomWidth: 1.5 },
  signature: { minHeight: 106, textAlignVertical: 'top' },
  metaRow: { marginTop: 6, flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  hint: { marginTop: 6, lineHeight: 18 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: { width: 80, height: 80, borderRadius: 999, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  actions: { marginTop: 24, paddingTop: 16, borderTopWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 20 },
  cancel: { minHeight: 44, justifyContent: 'center' },
  save: { minHeight: 44, flex: 1, borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
}))
