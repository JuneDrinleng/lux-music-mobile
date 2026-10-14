/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { useCallback, useEffect, useState } from 'react'
import { TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import { MdiIcon } from '@/components/common/MdiIcon'
import { TextButton } from '@/components/magazine'
import {
  buildTogetherDiagnosticText,
  computeTogetherDebugLiveMetrics,
  getTogetherDebugEvents,
  subscribeTogetherDebugTelemetry,
  type TogetherDebugLiveMetrics,
} from '@/core/together/debugTelemetry'
import { formatTogetherGateHint, type TogetherGateSnapshot } from '@/core/together/togetherGate'
import { useI18n } from '@/lang'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { magType } from '@/theme/magazineType'
import { clipboardWriteText, createStyle, toast } from '@/utils/tools'

const REFRESH_MS = 500

const useStyles = sharedLuxStyles((colors) => {
  const r = magazineRoles(colors)
  return createStyle({
    root: {
      position: 'absolute',
      left: 12,
      right: 12,
      bottom: 12,
      zIndex: 8,
    },
    card: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: r.rule,
      backgroundColor: r.paper,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 6,
    },
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    headTitle: {
      flex: 1,
      fontWeight: '800',
    },
    metricRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 8,
    },
    metricLabel: {
      flex: 1,
    },
    metricValue: {
      fontVariant: ['tabular-nums'],
      fontWeight: '700',
    },
    eventBlock: {
      marginTop: 4,
      gap: 2,
    },
    eventLine: {
      fontVariant: ['tabular-nums'],
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      marginTop: 4,
    },
  })
})

const formatMs = (value: number | null) => (value == null ? '—' : `${value}`)

export interface TogetherDebugPanelProps {
  visible: boolean
  gateSnap?: TogetherGateSnapshot | null
}

const TogetherDebugPanel = ({ visible, gateSnap }: TogetherDebugPanelProps) => {
  const styles = useStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const t = useI18n()
  const [collapsed, setCollapsed] = useState(false)
  const [metrics, setMetrics] = useState<TogetherDebugLiveMetrics | null>(null)
  const [events, setEvents] = useState(() => getTogetherDebugEvents())

  const refresh = useCallback(async() => {
    setMetrics(await computeTogetherDebugLiveMetrics())
    setEvents([...getTogetherDebugEvents()])
  }, [])

  useEffect(() => {
    if (!visible) return
    void refresh()
    const tick = setInterval(() => { void refresh() }, REFRESH_MS)
    return () => { clearInterval(tick) }
  }, [visible, refresh])

  useEffect(() => {
    if (!visible) return
    return subscribeTogetherDebugTelemetry(() => {
      setEvents([...getTogetherDebugEvents()])
    })
  }, [visible])

  const handleCopy = useCallback(async() => {
    const text = await buildTogetherDiagnosticText()
    clipboardWriteText(text)
    toast(t('together_debug_copied'))
  }, [t])

  if (!visible) return null

  return (
    <View style={styles.root} pointerEvents="box-none">
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.head}
          activeOpacity={0.8}
          onPress={() => { setCollapsed(v => !v) }}
          accessibilityRole="button"
        >
          <Text size={magType.meta.size} color={r.display} style={styles.headTitle}>
            {t('together_debug_panel_title')}
          </Text>
          <MdiIcon name={collapsed ? 'chevron-up' : 'chevron-down'} size={20} color={r.muted} />
        </TouchableOpacity>

        {collapsed
          ? null
          : (
            <>
              {gateSnap
                ? (
                  <MetricRow
                    label={t('together_debug_gate')}
                    value={formatTogetherGateHint(gateSnap)}
                    r={r}
                    styles={styles}
                  />
                  )
                : null}
              <MetricRow label={t('together_debug_host_pos')} value={`${formatMs(metrics?.hostPositionMs ?? null)} ms`} r={r} styles={styles} />
              <MetricRow label={t('together_debug_my_pos')} value={`${formatMs(metrics?.myPositionMs ?? null)} ms`} r={r} styles={styles} />
              <MetricRow label={t('together_debug_drift')} value={`${formatMs(metrics?.driftMs ?? null)} ms`} r={r} styles={styles} />
              <MetricRow label={t('together_debug_clock_offset')} value={`${formatMs(metrics?.clockOffsetMs ?? null)} ms`} r={r} styles={styles} />
              <MetricRow label={t('together_debug_rtt')} value={`${formatMs(metrics?.rttMs ?? null)} ms`} r={r} styles={styles} />
              <MetricRow
                label={t('together_debug_room')}
                value={`${metrics?.roomId?.slice(0, 8) ?? '—'} · ${metrics?.role ?? '—'}`}
                r={r}
                styles={styles}
              />
              <View style={styles.eventBlock}>
                <Text size={11} color={r.muted}>{t('together_debug_events')}</Text>
                {events.length
                  ? events.slice().reverse().map((event) => (
                    <Text key={`${event.at}-${event.kind}-${event.detail}`} size={10} color={r.quiet} style={styles.eventLine} numberOfLines={2}>
                      {event.kind} {event.detail}
                      {event.recvLatencyMs != null ? ` +${event.recvLatencyMs}ms` : ''}
                    </Text>
                  ))
                  : <Text size={10} color={r.quiet}>{t('together_debug_events_empty')}</Text>}
              </View>
              <View style={styles.actions}>
                <TextButton label={t('together_debug_copy')} onPress={() => { void handleCopy() }} />
              </View>
            </>
            )}
      </View>
    </View>
  )
}

const MetricRow = ({
  label,
  value,
  r,
  styles,
}: {
  label: string
  value: string
  r: ReturnType<typeof magazineRoles>
  styles: ReturnType<typeof useStyles>
}) => (
  <View style={styles.metricRow}>
    <Text size={11} color={r.muted} style={styles.metricLabel} numberOfLines={1}>{label}</Text>
    <Text size={11} color={r.ink} style={styles.metricValue}>{value}</Text>
  </View>
)

export default TogetherDebugPanel
