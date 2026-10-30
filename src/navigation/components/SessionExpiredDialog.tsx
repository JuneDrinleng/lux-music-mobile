/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { useEffect } from 'react'
import { BackHandler, View } from 'react-native'
import Text from '@/components/common/Text'
import { PrimaryButton, TextButton } from '@/components/magazine'
import { useI18n } from '@/lang'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { rgbaHex } from '@/theme/luxColorMath'
import { createStyle } from '@/utils/tools'
import { type ExpiredAccount } from '@/utils/sessionExpiredDialog'

export default function SessionExpiredDialog({ account, later, login }: {
  account: ExpiredAccount
  later: () => Promise<void>
  login: () => Promise<void>
}) {
  const styles = useStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const t = useI18n()
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { void later(); return true })
    return () => { subscription.remove() }
  }, [later])
  const hostname = account.host.replace(/^https?:\/\//i, '').split('/')[0]
  return <View style={styles.root}>
    <View style={styles.card} accessibilityViewIsModal>
      <Text size={11} color={r.eyebrow} style={styles.eyebrow}>{t('sync_expired_account', { username: account.username, host: hostname })}</Text>
      <Text size={20} color={r.ink} style={styles.title}>{t('sync_lux_session_expired_title')}</Text>
      <Text size={14} color={r.list} style={styles.body}>
        {t('sync_expired_reason')}{'\n'}{t('sync_expired_local_before')}<Text size={14} color={r.list} style={styles.bold}>{t('sync_expired_local_bold')}</Text>{t('sync_expired_local_after')}
      </Text>
      <View style={styles.actions}>
        <TextButton compact underline={false} label={t('sync_expired_later')} onPress={() => { void later() }} />
        <PrimaryButton compact labelSize={13} labelStyle={styles.primaryLabel} style={styles.primary} label={t('sync_expired_login')} onPress={() => { void login() }} />
      </View>
    </View>
  </View>
}

const useStyles = sharedLuxStyles(colors => {
  const r = magazineRoles(colors)
  return createStyle({
    root: { flex: 1, justifyContent: 'center', paddingHorizontal: 22, backgroundColor: rgbaHex(r.ink, 0.42) },
    card: { backgroundColor: r.paper, borderTopWidth: 2, borderTopColor: r.ink, borderRadius: 6, padding: 20 },
    eyebrow: { fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' },
    title: { fontWeight: '800', marginTop: 6 },
    body: { marginTop: 10, lineHeight: 21 },
    bold: { fontWeight: '700' },
    actions: { marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    primary: { paddingHorizontal: 14 },
    primaryLabel: { fontWeight: '700' },
  })
})
