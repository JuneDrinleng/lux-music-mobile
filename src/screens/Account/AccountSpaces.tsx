/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { useEffect, useRef, useState } from 'react'
import { View } from 'react-native'
import Text from '@/components/common/Text'
import { Rule, SecondaryButton } from '@/components/magazine'
import { useI18n } from '@/lang'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { createStyle } from '@/utils/tools'
import { getActiveSpace } from '@/utils/dataSpace'
import { spaceMeta } from '@/utils/dataSpace/operations'
import { loadAccountSpaces, switchAccountSpace } from '@/utils/accountSpaceSwitch'
import { pushSyncLoginScreen } from '@/navigation/navigation'

export default function AccountSpaces({ onManageData }: { onManageData: () => void }) {
  const t = useI18n()
  const styles = useStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const [items, setItems] = useState<Awaited<ReturnType<typeof loadAccountSpaces>>>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  useEffect(() => {
    let active = true
    void loadAccountSpaces().then(value => { if (active) setItems(value) }).catch(() => { if (active) setError(t('account_spaces_failed')) })
    return () => { active = false }
  }, [t])
  const run = async(action: () => Promise<void>) => {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    try { await action() } catch { setError(t('spaces_action_failed')) } finally { pending.current = false; setBusy(false) }
  }
  return <>
    <Text size={32} color={r.display} style={styles.title}>{t('spaces_title')}</Text>
    <Text size={12} color={r.muted} style={styles.subtitle}>{t('spaces_subtitle')}</Text>
    <Rule gapTop={22} style={{ height: 2, opacity: 1 }} />
    <View style={styles.section}><Text size={22} color={r.ink} style={styles.heavy}>{t('spaces_section')}</Text><Text size={12} color={r.muted} style={styles.bold}>{t('spaces_count', { count: items.length })}</Text></View>
    {items.map(({ space, session, contents }, index) => {
      const current = space.id === getActiveSpace()
      const name = space.kind === 'local' ? t('account_local') : space.label ?? space.username ?? ''
      return <View key={space.id} style={styles.row}>
        <View style={[styles.avatar, { backgroundColor: space.kind === 'local' ? colors.surface.placeholder : index % 2 ? r.accentSoft : colors.iconWrap.orange }]}><Text size={17} color={r.ink} style={styles.heavy}>{space.kind === 'local' ? 'L' : name.slice(0, 1).toUpperCase()}</Text></View>
        <View style={styles.flex}><View style={styles.name}><Text size={15} color={r.list} style={styles.bold}>{name}</Text>{current ? <View style={styles.badge}><Text size={11} color={r.onAccent} style={styles.bold}>{t('spaces_current')}</Text></View> : null}</View><Text size={12} color={r.muted} style={styles.subtitle}>{spaceMeta(space, current, !!session, contents, t)}</Text></View>
        {!current ? <SecondaryButton compact label={t('spaces_switch')} disabled={busy} style={styles.button} onPress={() => { void run(async() => switchAccountSpace(space, session)) }} /> : null}
      </View>
    })}
    <View style={styles.actions}><SecondaryButton compact label={t('spaces_add')} disabled={busy} style={styles.button} onPress={() => { void run(async() => pushSyncLoginScreen({ onboarding: false, initialHost: null, initialUsername: '', targetProvider: 'lux' })) }} /><SecondaryButton compact label={t('spaces_manage')} disabled={busy} style={styles.button} onPress={onManageData} /></View>
    {error ? <Text size={12} color={r.danger} style={styles.subtitle} accessibilityLiveRegion="polite">{error}</Text> : null}
  </>
}
const useStyles = sharedLuxStyles(colors => {
  const r = magazineRoles(colors)
  return createStyle({
    title: { lineHeight: 38, fontWeight: '800' },
    subtitle: { marginTop: 4 },
    section: { marginTop: 12, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
    row: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: r.hairline },
    flex: { flex: 1, minWidth: 0 },
    avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    heavy: { fontWeight: '800' },
    bold: { fontWeight: '700' },
    name: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
    badge: { backgroundColor: r.accent, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8 },
    actions: { marginTop: 16, flexDirection: 'row', gap: 8 },
    button: { paddingHorizontal: 14 },
  })
})
