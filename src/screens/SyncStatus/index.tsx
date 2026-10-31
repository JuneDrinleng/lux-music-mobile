/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { useEffect } from 'react'
import { BackHandler, ScrollView, View, TouchableOpacity } from 'react-native'
import Text from '@/components/common/Text'
import StatusBar from '@/components/common/StatusBar'
import { BackButton, PrimaryButton, SecondaryButton, SectionHeader, SettingRow } from '@/components/magazine'
import { useI18n } from '@/lang'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { createStyle, clipboardWriteText } from '@/utils/tools'
import { syncHostname, type SyncStatusModel } from '@/utils/syncStatus'
import { MdiIcon } from '@/components/common/MdiIcon'
import { useStatusbarHeight } from '@/store/common/hook'
import useSystemGestureInsetBottom from '@/utils/hooks/useSystemGestureInsetBottom'

/** Independent sibling of account controls; the layout reserves its full 44pt target. */
export function SyncStatusPill({ model, onPress }: { model: SyncStatusModel, onPress: () => void }) {
  const t = useI18n()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const styles = useStyles()
  const error = model.route !== 'sync'
  const active = ['synced', 'connecting', 'syncing'].includes(model.kind)
  const color = error ? r.danger : active ? r.accentInk : r.muted
  const icon = model.kind === 'synced' ? 'check' : model.kind === 'expired' ? 'clock-alert-outline'
    : model.kind === 'incompatible' ? 'alert-outline' : error ? 'alert-circle-outline'
      : active ? 'sync' : 'cloud-off-outline'
  return <TouchableOpacity style={styles.pillTarget} activeOpacity={0.7} onPress={onPress}
    accessibilityRole="button" accessibilityLiveRegion="polite"
    accessibilityLabel={t('sync_state_pill_accessibility', { status: t(model.pillKey) })}>
    <View style={[styles.pill, { backgroundColor: active ? r.accentSoft : r.paper, borderColor: error ? r.danger : active ? r.accentSoft : r.hairline }]}>
      <MdiIcon name={icon} size={12} color={color} />
      <Text size={11} color={color} style={styles.pillLabel}>{t(model.pillKey)}</Text>
    </View>
  </TouchableOpacity>
}

/** Shared by the sync service editor and all error detail pages. A timestamp is history, not reachability. */
export function SyncConnectionInfo({ model, host, username }: { model: SyncStatusModel, host: string, username: string }) {
  const t = useI18n()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const styles = useStyles()
  const timestamp = model.lastSyncedAt
  const lastActivity = timestamp != null && Number.isFinite(timestamp) && timestamp > 0
    ? new Date(timestamp).toLocaleString() : t('sync_state_no_record')
  return <View style={styles.section}>
    <SectionHeader title={t('sync_state_connection_info')} showRule ruleGap={22} headGap={6} />
    <SettingRow icon="server" iconBg={r.iconWrap.purple} title={t('sync_state_server')} subtitle={host || t('sync_state_no_record')}
      onPress={host ? () => { clipboardWriteText(host) } : undefined} />
    <SettingRow icon="account-outline" iconBg={r.iconWrap.purple} title={t('sync_state_username')} subtitle={username || t('sync_state_no_record')} />
    <SettingRow icon="cloud-outline" iconBg={r.iconWrap.purple} title={t('sync_state_connection_status')} subtitle={t(model.pillKey)} />
    <SettingRow icon="history" iconBg={r.iconWrap.purple} title={t('sync_state_last_activity')} subtitle={lastActivity} last />
  </View>
}

export default function SyncStatusPage({ model, connectionModel = model, host, username, onBack, onHome, onRetry, onCheckAddress, onLogin, onLocal }: {
  model: SyncStatusModel
  connectionModel?: SyncStatusModel
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
      <SyncConnectionInfo model={connectionModel} host={host} username={username} />
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
  pillTarget: { minHeight: 44, minWidth: 70, maxWidth: '100%', flexShrink: 0, justifyContent: 'center', paddingVertical: 8 },
  pillLabel: { fontWeight: '700', flexShrink: 1 },
  pill: { minHeight: 28, paddingHorizontal: 8, borderRadius: 99, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
}))
