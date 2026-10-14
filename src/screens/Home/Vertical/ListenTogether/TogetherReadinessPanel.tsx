/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { useCallback, useEffect, useState } from 'react'
import { View } from 'react-native'

import Text from '@/components/common/Text'
import { TextButton } from '@/components/magazine'
import { buildTogetherDiagnosticText } from '@/core/together/debugTelemetry'
import { isTogetherDebugPanelBuild } from '@/core/together/debugPanelPreference'
import { getTogetherReadinessForUi } from '@/core/together'
import { useI18n } from '@/lang'
import { type TogetherGateSnapshot } from '@/plugins/sync/client/togetherReady'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { createStyle, toast, clipboardWriteText } from '@/utils/tools'

const useStyles = sharedLuxStyles((colors) => {
  const r = magazineRoles(colors)
  return createStyle({
    box: {
      marginTop: 16,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: r.hairline,
      borderRadius: 8,
      gap: 6,
    },
    row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
    title: { fontWeight: '700', marginBottom: 4 },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  })
})

const gateLabel = (
  t: ReturnType<typeof useI18n>,
  key: keyof TogetherGateSnapshot,
  value: TogetherGateSnapshot[keyof TogetherGateSnapshot],
): string => {
  const on = value === true
  const off = value === false
  const mark = on ? '✓' : off ? '✗' : '?'
  switch (key) {
    case 'luxMode': return `${mark} ${t('together_readiness_gate_lux')}`
    case 'syncSocketReady': return `${mark} ${t('together_readiness_gate_socket')}`
    case 'featureEnabled': return `${mark} ${t('together_readiness_gate_feature')}`
    case 'moduleReady': return `${mark} ${t('together_readiness_gate_module')}`
    case 'rpcReady': return `${mark} ${t('together_readiness_gate_rpc')}`
    default: return `${mark} ${String(value)}`
  }
}

export interface TogetherReadinessPanelProps {
  uiConnection: string
}

const TogetherReadinessPanel = ({ uiConnection }: TogetherReadinessPanelProps) => {
  const styles = useStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const t = useI18n()
  const [gate, setGate] = useState<TogetherGateSnapshot | null>(null)

  const refresh = useCallback(() => {
    void getTogetherReadinessForUi().then(setGate)
  }, [])

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, 2000)
    return () => { clearInterval(timer) }
  }, [refresh])

  const handleCopy = useCallback(async() => {
    const text = await buildTogetherDiagnosticText()
    const gateLines = gate
      ? [
          '',
          'gate:',
          `luxMode=${gate.luxMode}`,
          `syncSocketReady=${gate.syncSocketReady}`,
          `featureEnabled=${gate.featureEnabled}`,
          `moduleReady=${gate.moduleReady}`,
          `rpcReady=${gate.rpcReady}`,
          `uiConnection=${uiConnection}`,
        ].join('\n')
      : ''
    clipboardWriteText(`${text}${gateLines}`)
    toast(t('together_debug_copied'))
  }, [gate, t, uiConnection])

  if (!isTogetherDebugPanelBuild()) return null

  return (
    <View style={styles.box}>
      <Text size={13} color={r.display} style={styles.title}>{t('together_readiness_title')}</Text>
      {gate
        ? (Object.keys(gate) as Array<keyof TogetherGateSnapshot>).map((key) => (
            <View key={key} style={styles.row}>
              <Text size={12} color={r.muted}>{gateLabel(t, key, gate[key])}</Text>
            </View>
          ))
        : <Text size={12} color={r.quiet}>{t('together_readiness_loading')}</Text>}
      <Text size={11} color={r.quiet}>
        {t('together_readiness_gate_ui', { connection: uiConnection })}
      </Text>
      <View style={styles.actions}>
        <TextButton label={t('together_readiness_refresh')} onPress={refresh} />
        <TextButton label={t('together_debug_copy')} onPress={() => { void handleCopy() }} />
      </View>
    </View>
  )
}

export default TogetherReadinessPanel
