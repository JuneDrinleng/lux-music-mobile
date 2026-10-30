/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import { useMemo, useRef, useState } from 'react'
import { Animated, PanResponder, ScrollView, View } from 'react-native'
import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import { MagazineSheet, SecondaryButton, TextButton } from '@/components/magazine'
import { selectRequestQueueModel, type RoomFeedState } from '@/core/together/roomFeed'
import { reorderRequestIds } from '@/core/together/roomUi'
import { useI18n } from '@/lang'
import { togetherRoomFeed } from '@/store/together/roomFeed'
import { useLuxTheme, sharedLuxStyles } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { useBackHandler } from '@/utils/hooks/useBackHandler'
import { createStyle } from '@/utils/tools'
import { performRoomAction } from './RoomFeedView'

const useStyles = sharedLuxStyles(colors => {
  const r = magazineRoles(colors)
  return createStyle({
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, borderBottomWidth: 1, borderBottomColor: r.hairline },
    cover: { width: 36, height: 36, borderRadius: 4, backgroundColor: r.placeholder },
    handle: { minWidth: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    foot: { textAlign: 'center', marginVertical: 8 },
  })
})

function DragHandle({ onDrop, disabled }: { onDrop: (delta: number) => void, disabled: boolean }) {
  const styles = useStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const t = useI18n()
  const latest = useRef({ onDrop, disabled })
  latest.current = { onDrop, disabled }
  const [dragging, setDragging] = useState(false)
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !latest.current.disabled,
    onMoveShouldSetPanResponder: () => !latest.current.disabled,
    onPanResponderGrant: () => { setDragging(true) },
    onPanResponderRelease: (_, gesture) => { setDragging(false); latest.current.onDrop(gesture.dy) },
    onPanResponderTerminate: () => { setDragging(false) },
  }), [])
  return <Animated.View {...pan.panHandlers} style={[styles.handle, { opacity: dragging ? 0.5 : 1 }]} accessible accessibilityRole="adjustable" accessibilityLabel={t('together_drag')} accessibilityActions={[{ name: 'increment', label: t('together_move_down') }, { name: 'decrement', label: t('together_move_up') }]} onAccessibilityAction={event => { if (!disabled) onDrop(event.nativeEvent.actionName == 'increment' ? 1 : -1) }}>
    <Text size={12} color={r.muted}>≡ {t('together_drag')}</Text>
  </Animated.View>
}

export default function RequestSheet({ feed, selfId, hostId, bottomInset, onClose, onPickSong }: {
  feed: RoomFeedState
  selfId: string | null
  hostId: string
  bottomInset: number
  onClose: () => void
  onPickSong: () => void
}) {
  const styles = useStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const t = useI18n()
  const [busy, setBusy] = useState(false)
  const rowHeight = useRef(56)
  const model = selectRequestQueueModel(feed, selfId, hostId)
  useBackHandler(() => { onClose(); return true })
  const act = (action: () => Promise<unknown>) => {
    if (busy) return
    setBusy(true)
    void performRoomAction(action, t('together_action_failed')).finally(() => { setBusy(false) })
  }
  return <MagazineSheet visible inlineBottomInset={bottomInset} heightRatio={600 / 844} inviteLayout onClose={onClose} eyebrow={t('together_request_eyebrow')} title={t('together_requests')} figure={{ value: String(model.pending.length), unit: t('together_request_unit') }} meta={t('together_request_limits', { count: model.limits.perMember })} headerAction={{ text: t('together_request_add'), disabled: !model.canRequest || busy, onPress: onPickSong }}>
    <ScrollView keyboardShouldPersistTaps="handled">
      {model.pending.map((entry, index) => <View key={entry.id} style={styles.row} onLayout={event => { rowHeight.current = event.nativeEvent.layout.height }}>
        <Text size={13} color={r.quiet} style={{ width: 20, fontWeight: '700' }}>{String(index + 1).padStart(2, '0')}</Text>
        <Image url={entry.request.song.meta.picUrl ?? ''} style={styles.cover} />
        <View style={{ flex: 1, minWidth: 0 }}><Text size={15} color={r.list} style={{ fontWeight: '700' }} numberOfLines={1}>{entry.request.song.name}</Text><Text size={12} color={r.muted} numberOfLines={1}>{entry.request.song.singer} · {t('together_requested_by', { name: entry.request.requestedBy.displayName })}</Text></View>
        {model.canManage ? <DragHandle disabled={busy} onDrop={delta => {
          // Accessibility uses ±1, touch uses physical row height.
          const shift = Math.abs(delta) == 1 ? delta : Math.round(delta / rowHeight.current)
          const target = Math.max(0, Math.min(model.pending.length - 1, index + shift))
          if (target != index) act(async() => togetherRoomFeed.reorderRequests(reorderRequestIds(model.pending.map(item => item.request.id), index, target)))
        }} /> : null}
        {model.canManage || entry.request.requestedBy.memberId == selfId ? <TextButton compact label="×" accessibilityLabel={t('together_request_remove')} labelSize={16} style={{ minWidth: 44, minHeight: 28 }} underline={false} disabled={busy} onPress={() => { act(async() => togetherRoomFeed.requestAction('remove', entry.request.id)) }} /> : null}
      </View>)}
      <Text size={12} color={r.muted} style={styles.foot}>{t('together_request_return')}</Text>
      {model.canManage && model.pending.length ? <SecondaryButton compact label={t('together_request_approve')} disabled={busy} onPress={() => { act(async() => togetherRoomFeed.requestAction('approve', model.pending[0].request.id)) }} /> : null}
    </ScrollView>
  </MagazineSheet>
}
