import { useRef, useState } from 'react'
import { View } from 'react-native'
import Text from '@/components/common/Text'
import { TextButton } from '@/components/magazine'
import { useI18n } from '@/lang'
import { useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { enterLocalSpace } from '@/utils/enterLocalSpace'
import { setSyncMode, setSyncLoginCompleted } from '@/utils/data'
import { navigations } from '@/navigation'

export default function SyncLoginLocalAction({ disabled = false, onBusyChange }: { disabled?: boolean, onBusyChange?: (busy: boolean) => void }) {
  const t = useI18n()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const pending = useRef(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const handleUseLocal = async() => {
    if (disabled || pending.current) return
    pending.current = true
    setBusy(true)
    onBusyChange?.(true)
    setMessage('')
    try {
      await enterLocalSpace(t('sync_login_local_user_name'))
      await setSyncMode('lx')
      await setSyncLoginCompleted(true)
      await navigations.pushHomeScreen()
      global.lx.isShowingLaunchScreen = false
      void global.lx._onLoginConfirmed?.()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      pending.current = false
      setBusy(false)
      onBusyChange?.(false)
    }
  }
  return <View style={{ marginTop: 14, gap: 8 }}>
    <TextButton compact style={{ minHeight: 28 }} muted label={t('sync_login_skip')} disabled={disabled || busy} onPress={() => { void handleUseLocal() }} />
    <Text size={12} color={r.muted}>{t('sync_login_skip_note')}</Text>
    {message ? <Text size={12} color={r.danger} accessibilityLiveRegion="polite">{message}</Text> : null}
  </View>
}
