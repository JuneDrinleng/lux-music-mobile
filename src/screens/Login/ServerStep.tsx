/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { BackHandler, ScrollView, View } from 'react-native'
import LanguageSwitch from '@/components/common/LanguageSwitch'
import { getSyncHostHistory } from '@/utils/data'
import Text from '@/components/common/Text'
import StatusBar from '@/components/common/StatusBar'
import { BackButton, PrimaryButton, SecondaryButton, TextButton, OptionRow, UnderlineInput } from '@/components/magazine'
import { useLuxTheme, sharedLuxStyles } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { createStyle } from '@/utils/tools'
import { useStatusbarHeight } from '@/store/common/hook'
import { useI18n } from '@/lang'
import { navigations } from '@/navigation'
import { createServerChecker, initialServerCheck, parseServerInfo } from '@/utils/serverCheck'

export default function ServerStep({ onBack, onReady, showHistory = false, disabled = false, initialHost = '', children }: { onBack: () => void, onReady?: (host: string) => void, showHistory?: boolean, disabled?: boolean, initialHost?: string, children?: ReactNode }) {
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const styles = useStyles()
  const t = useI18n()
  const statusBarHeight = useStatusbarHeight()
  const [address, setAddress] = useState(initialHost)
  const [state, setState] = useState(initialServerCheck)
  const [opening, setOpening] = useState(false)
  const blocked = opening || disabled
  const [history, setHistory] = useState<string[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  useEffect(() => {
    let active = true
    if (showHistory) void getSyncHostHistory().then(hosts => { if (active) setHistory([...hosts]) }).catch(() => {})
    return () => { active = false }
  }, [showHistory])
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { if (!blocked) onBack(); return true })
    return () => { subscription.remove() }
  }, [onBack, blocked])
  const checker = useMemo(() => createServerChecker({
    clientVersion: process.versions.app,
    onChange: setState,
    request: async(url, signal) => {
      const response = await fetch(url, { signal, headers: { 'Cache-Control': 'no-cache' } })
      if (!response.ok) throw new Error('Server unavailable')
      return parseServerInfo(await response.json())
    },
  }), [])
  useEffect(() => { if (initialHost) checker.input(initialHost) }, [checker, initialHost])
  useEffect(() => () => { checker.dispose() }, [checker])
  const pending = state.status === 'checking'
  const row = (label: string, value: boolean | null, detail?: string) => (
    <Text size={14} color={value === true ? r.accentInk : value === false ? r.danger : r.muted} style={styles.resultRow}>
      {value === true ? '✓ ' : value === false ? '⚠ ' : '· '}{label}
      {detail ? <Text size={12} color={r.muted}>{detail}</Text> : null}
    </Text>
  )
  return (
    <View style={[styles.page, { backgroundColor: r.paper, paddingTop: statusBarHeight }]}>
      <StatusBar />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.top}><BackButton onPress={() => { if (!blocked) onBack() }} accessibilityLabel={t('back')} /><LanguageSwitch /></View>
        <Text size={11} color={r.eyebrow} style={styles.eyebrow}>{t('onboard_connect')}</Text>
        <Text size={32} color={r.display} style={styles.title}>{t('onboard_server_title')}</Text>
        <View style={styles.field}>
          <Text size={12} color={r.muted} style={styles.bold}>{t('onboard_address')}</Text>
          <UnderlineInput
            value={address}
            onChangeText={value => { setAddress(value); checker.input(value) }}
            onBlur={() => { if (state.url) setAddress(state.url) }}
            autoCapitalize="none"
            autoCorrect={false}
            inputMode="url"
            accessibilityLabel={t('onboard_address')}
            style={[styles.input, { borderBottomColor: r.ink }]}
          />
        </View>
        {showHistory && history.length ? <View style={styles.history}>
          <TextButton compact style={{ minHeight: 28 }} label={t('sync_login_host_history')} onPress={() => { setHistoryOpen(value => !value) }} />
          {historyOpen ? history.map(host => <OptionRow key={host} label={host} selected={address === host} onPress={() => { setAddress(host); checker.input(host); setHistoryOpen(false) }} />) : null}
        </View> : null}
        <View style={[styles.card, { backgroundColor: r.paperRaised }]} accessibilityLiveRegion="polite">
          <Text size={11} color={r.eyebrow} style={styles.cardLabel}>{t('onboard_results')}</Text>
          {row(t(pending ? 'onboard_checking' : state.error === 'timeout' ? 'onboard_timeout' : state.error === 'invalid' ? 'onboard_invalid' : state.reachable === false ? 'onboard_unreachable' : 'onboard_reachable'), state.reachable, state.latency == null ? undefined : t('onboard_latency', { ms: state.latency }))}
          {row(t(state.compatible === false ? 'onboard_incompatible' : 'onboard_compatible'), state.compatible, state.info ? t('onboard_version_detail', { version: state.info.version, minimum: state.info.minClientVersion ?? t('onboard_no_minimum') }) : undefined)}
          {row(t(state.https === false ? 'onboard_http_warning' : 'onboard_https'), state.https)}
          <Text size={14} color={state.registration ? r.ink : r.muted} style={styles.resultRow}>
            {t(state.registration ? !state.registration.enabled ? 'onboard_registration_closed' : state.registration.inviteOnly ? 'onboard_registration_invite' : 'onboard_registration_open' : 'onboard_registration_unknown')}
          </Text>
        </View>
        <Text size={12} color={r.muted} style={styles.hint}>{t('onboard_check_hint')}</Text>
        {children}
      </ScrollView>
      <View style={[styles.footer, { borderTopColor: r.ink }]}>
        <SecondaryButton compact label={t('onboard_recheck')} disabled={!address.trim() || blocked} onPress={() => { void checker.check(address) }} />
        <PrimaryButton compact style={styles.next} label={t('onboard_next_login')} disabled={state.status !== 'ok' || blocked} onPress={() => {
          if (onReady) { onReady(state.url); return }
          setOpening(true)
          void navigations.pushSyncLoginScreen({ onboarding: true, initialHost: state.url }).catch(() => { setOpening(false) })
        }} />
      </View>
    </View>
  )
}

const useStyles = sharedLuxStyles(() => createStyle({
  page: { flex: 1 },
  content: { paddingHorizontal: 22, paddingBottom: 28 },
  top: { marginTop: 10, minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  history: { marginTop: 14 },
  eyebrow: { marginTop: 6, fontWeight: '700', letterSpacing: 2 },
  title: { lineHeight: 38, fontWeight: '800' },
  field: { marginTop: 16 },
  bold: { fontWeight: '700' },
  input: { fontWeight: '400', borderBottomWidth: 1.5 },
  card: { marginTop: 18, borderRadius: 6, padding: 14 },
  cardLabel: { fontWeight: '700', letterSpacing: 2, marginBottom: 6, lineHeight: 26 },
  resultRow: { fontWeight: '700', lineHeight: 26 },
  hint: { marginTop: 14 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 16, borderTopWidth: 2, paddingHorizontal: 22, paddingTop: 20, paddingBottom: 34 },
  next: { flex: 1 },
}))
