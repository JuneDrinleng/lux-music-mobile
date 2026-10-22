/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { useEffect, useState } from 'react'
import { Modal, ScrollView, View } from 'react-native'
import Text from '@/components/common/Text'
import StatusBar from '@/components/common/StatusBar'
import { MagTopBar, Rule, SecondaryButton } from '@/components/magazine'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { createStyle } from '@/utils/tools'
import { useStatusbarHeight } from '@/store/common/hook'
import useSystemGestureInsetBottom from '@/utils/hooks/useSystemGestureInsetBottom'
import { useI18n } from '@/lang'
import { requestJson } from '@/plugins/sync/client/auth'
import { findLuxAuthForHost } from '@/utils/data'
import { getActiveSpace } from '@/utils/dataSpace'
import { aiOperationKey, aiOperationTime, aiRelativeTime, aiScopeKeys, loadAiTokenStatus, type AiStatus } from '@/utils/aiTokenStatus'

export default function AiTokenStatusPage({ host, lux, onBack }: { host: string, lux: boolean, onBack: () => void }) {
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const styles = useStyles()
  const t = useI18n()
  const top = useStatusbarHeight()
  const bottom = useSystemGestureInsetBottom()
  const [state, setState] = useState<AiStatus | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [now, setNow] = useState(Date.now())
  const space = getActiveSpace()
  useEffect(() => {
    let active = true
    setState(null)
    void loadAiTokenStatus({ local: !lux || space === 'local', host, session: async() => findLuxAuthForHost(host), request: requestJson }).then(value => {
      if (active) { setState(value); setNow(Date.now()) }
    })
    return () => { active = false }
  }, [host, lux, space, attempt])
  useEffect(() => {
    const timer = setInterval(() => { setNow(Date.now()) }, 60000)
    return () => { clearInterval(timer) }
  }, [])
  const relative = (at: number | null) => {
    const value = aiRelativeTime(at, now)
    return t(value.key, { count: value.count ?? 0 })
  }
  const operationTime = (at: number) => {
    const value = aiOperationTime(at, now)
    return `${value.day ? t(value.day) : value.date} ${value.time}`
  }
  return <Modal visible animationType="slide" onRequestClose={onBack} statusBarTranslucent>
    <StatusBar />
    <ScrollView style={{ backgroundColor: r.paper }} contentContainerStyle={[styles.content, { paddingTop: top, paddingBottom: bottom + 28 }]}>
      <MagTopBar onBack={onBack} />
      <Text size={11} color={r.eyebrow} style={styles.eyebrow}>{t('ai_tokens_eyebrow')}</Text>
      <Text size={32} color={r.display} style={styles.title}>{t('ai_tokens_title')}</Text>
      {state?.kind === 'ready' ? <>
        {state.tokens.length ? state.tokens.map(token => <View key={token.id} style={[styles.card, { backgroundColor: r.paperRaised, borderTopColor: r.ink }]}>
          <View style={styles.cardHead}>
            <Text size={15} color={r.list} style={[styles.bold, styles.flex]}>{token.name}</Text>
            <View style={[styles.badge, { backgroundColor: r.accentSoft }]}><Text size={12} color={r.accentInk} style={styles.bold}>{`● ${relative(token.lastUsedAt)}`}</Text></View>
          </View>
          <Text size={12} color={r.muted} style={styles.subtitle}>{aiScopeKeys(token.scopes).map(key => t(key)).join(t('ai_tokens_separator'))}</Text>
        </View>) : <Text size={12} color={r.muted} style={styles.message}>{t('ai_tokens_empty')}</Text>}
        <Rule gapTop={22} style={{ height: 2, opacity: 1 }} />
        <View style={styles.section}><Text size={22} color={r.ink} style={styles.heavy}>{t('ai_tokens_recent')}</Text><Text size={12} color={r.muted} style={styles.bold}>{t('ai_tokens_recorded')}</Text></View>
        {state.operations.length ? state.operations.map((op, index) => <View key={`${op.tokenId}:${index}`} style={[styles.row, { borderBottomColor: r.hairline }]}>
          <Text size={15} color={r.list} style={styles.bold}>{t(aiOperationKey(op.action))}{!op.ok ? t('ai_tokens_failed') : ''}</Text>
          <Text size={12} color={r.muted} style={styles.subtitle}>{operationTime(op.at)}{state.tokens.length > 1 ? ` · ${state.tokens.find(token => token.id === op.tokenId)?.name ?? ''}` : ''}</Text>
        </View>) : <Text size={12} color={r.muted} style={styles.message}>{t('ai_tokens_no_operations')}</Text>}
      </> : <View style={styles.message} accessibilityLiveRegion="polite">
        <Text size={15} color={r.muted}>{t(!state ? 'ai_tokens_loading' : state.kind === 'local' ? 'ai_tokens_local' : state.kind === 'signedOut' ? 'ai_tokens_signed_out' : state.kind === 'unsupported' ? 'ai_tokens_unsupported' : state.kind === 'timeout' ? 'ai_tokens_timeout' : 'ai_tokens_error')}</Text>
        {state && ['error', 'timeout', 'unsupported'].includes(state.kind) ? <SecondaryButton compact label={t('ai_tokens_retry')} onPress={() => { setAttempt(value => value + 1) }} style={{ alignSelf: 'flex-start', marginTop: 16 }} /> : null}
      </View>}
      <Text size={12} color={r.muted} style={styles.hint}>{t('ai_tokens_management_hint')}</Text>
    </ScrollView>
  </Modal>
}
const useStyles = sharedLuxStyles(() => createStyle({
  content: { paddingHorizontal: 22, flexGrow: 1 },
  eyebrow: { marginTop: 6, fontWeight: '700', letterSpacing: 2 },
  title: { fontWeight: '800', lineHeight: 38 },
  heavy: { fontWeight: '800' },
  bold: { fontWeight: '700' },
  flex: { flex: 1 },
  card: { marginTop: 14, borderTopWidth: 3, borderRadius: 6, padding: 14 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  badge: { borderRadius: 10, paddingVertical: 2, paddingHorizontal: 8 },
  subtitle: { marginTop: 2 },
  section: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  row: { minHeight: 56, justifyContent: 'center', borderBottomWidth: 1, paddingVertical: 8 },
  message: { marginTop: 14 },
  hint: { marginTop: 14 },
}))
