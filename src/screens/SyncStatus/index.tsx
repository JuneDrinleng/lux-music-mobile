/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { useEffect } from 'react'
import { BackHandler, ScrollView, View, TouchableOpacity } from 'react-native'
import Text from '@/components/common/Text'
import StatusBar from '@/components/common/StatusBar'
import { BackButton, PrimaryButton, SecondaryButton } from '@/components/magazine'
import { useI18n } from '@/lang'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { createStyle, clipboardWriteText } from '@/utils/tools'
import { syncHostname, syncStatusText, type SyncStatusModel } from '@/utils/syncStatus'
import { relativeActivity } from '@/utils/accountPage'
import { useStatusbarHeight } from '@/store/common/hook'
import useSystemGestureInsetBottom from '@/utils/hooks/useSystemGestureInsetBottom'

export function SyncStatusRow({ model, name, host, now, onPress }: { model: SyncStatusModel, name: string, host: string, now: number, onPress: () => void }) {
  const t = useI18n()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const styles = useStyles()
  const relative = relativeActivity(model.lastSyncedAt == null ? '' : new Date(model.lastSyncedAt).toISOString(), now)
  const text = syncStatusText(model, { name, host, relative: t(relative.key, relative.args), unknown: t('sync_state_unknown_version') })
  const detail = model.kind === 'synced' ? text.syncedDetail : t(text.detailKey, { seconds: model.seconds ?? 0, version: text.version, minimum: text.minimum })
  return <View style={styles.section}>
    <View style={[styles.rule, { backgroundColor: r.ink }]} />
    <Text size={22} color={r.ink} style={styles.sectionTitle}>{t('sync_state_section')}</Text>
    <TouchableOpacity style={styles.row} activeOpacity={0.7} accessibilityRole="button" onPress={onPress}>
      <View style={styles.rowText}>
        <Text size={15} color={model.kind === 'synced' ? r.accentInk : model.kind === 'expired' ? r.ink : r.like} style={styles.bold}>{text.symbol} {t(model.titleKey)}</Text>
        <Text size={12} color={r.muted} style={styles.subtitle}>{detail}</Text>
      </View>
      <Text size={18} color={r.ink}>›</Text>
    </TouchableOpacity>
  </View>
}

export default function SyncStatusPage({ model, host, username, onBack, onHome, onRetry, onCheckAddress, onLogin, onLocal }: {
  model: SyncStatusModel
  host: string
  username: string
  onBack: () => void
  onHome: () => void
  onRetry: () => void
  onCheckAddress: () => void
  onLogin: () => void
  onLocal: () => void
}) {
  const t = useI18n()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const styles = useStyles()
  const top = useStatusbarHeight()
  const bottom = useSystemGestureInsetBottom()
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { onBack(); return true })
    return () => { subscription.remove() }
  }, [onBack])
  const expired = model.kind === 'expired'
  const incompatible = model.kind === 'incompatible'
  const version = model.serverVersion ?? t('sync_state_unknown_version')
  const minimum = model.requiredVersion ?? t('sync_state_unknown_version')
  const body = t(expired ? 'sync_state_expired_body' : incompatible ? 'sync_state_version_body' : 'sync_state_unreachable_body', { version, minimum })
  return <View style={[styles.page, { backgroundColor: r.paper, paddingTop: top }]}>
    <StatusBar />
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottom + 28 }]}>
      <View style={styles.top}><BackButton compact onPress={onBack} accessibilityLabel={t('back')} /></View>
      <Text size={11} color={r.eyebrow} style={styles.eyebrow}>{t(expired ? 'sync_state_account' : 'sync_state_connection', { value: expired ? username : syncHostname(host) })}</Text>
      <Text size={56} color={r.ink} style={styles.symbol}>{expired ? '⌛' : incompatible ? '≠' : '⌁'}</Text>
      <Text size={32} color={r.display} style={styles.title}>{t(expired ? 'sync_state_expired_title' : model.titleKey)}</Text>
      <Text size={15} color={r.list} style={styles.body}>{body}</Text>
      {!expired && !incompatible ? <Text size={12} color={r.muted} style={styles.meta} accessibilityLiveRegion="polite">
        {t(model.seconds == null ? 'sync_state_attempts_manual' : 'sync_state_attempts', { count: model.attempts, seconds: model.seconds ?? 0 })}
      </Text> : null}
      <View style={styles.actions}>
        <PrimaryButton compact style={styles.button} labelSize={13} labelStyle={styles.bold}
          label={t(expired ? 'sync_state_relogin' : incompatible ? 'sync_state_copy' : 'sync_state_retry')}
          onPress={expired ? onLogin : incompatible ? () => { clipboardWriteText(body) } : onRetry} />
        {!expired && !incompatible ? <SecondaryButton compact style={styles.button} label={t('sync_state_check_address')} onPress={onCheckAddress} /> : null}
        <SecondaryButton compact style={styles.button} label={t(expired ? 'sync_state_local' : 'sync_state_offline')} onPress={expired ? onLocal : onHome} />
      </View>
    </ScrollView>
  </View>
}

const useStyles = sharedLuxStyles(() => createStyle({
  page: { flex: 1 },
  content: { paddingHorizontal: 22 },
  top: { marginTop: 10, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  eyebrow: { marginTop: 6, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' },
  symbol: { marginTop: 20, fontWeight: '800', lineHeight: 84 },
  title: { marginTop: 6, fontWeight: '800', lineHeight: 38 },
  body: { marginTop: 12, lineHeight: 23 },
  meta: { marginTop: 10 },
  actions: { marginTop: 22, gap: 10, alignItems: 'flex-start' },
  button: { paddingHorizontal: 14, borderRadius: 15 },
  bold: { fontWeight: '700' },
  section: { marginTop: 22 },
  rule: { height: 2, marginBottom: 12 },
  sectionTitle: { fontWeight: '800' },
  row: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowText: { flex: 1 },
  subtitle: { marginTop: 2 },
}))
