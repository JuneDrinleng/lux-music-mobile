/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Animated, Easing, ScrollView, View } from 'react-native'
import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import { PrimaryButton, SecondaryButton, SectionHeader, TextButton, TextTabs, UnderlineInput } from '@/components/magazine'
import { resolveTogetherLayout, selectRoomTimeline, type RoomFeedState, type TimelineEntry } from '@/core/together/roomFeed'
import { appendFloatingReactions, expireFloatingReactions, FLOATING_REACTION_TTL, roomUiTabs, type FloatingReaction } from '@/core/together/roomUi'
import { useI18n } from '@/lang'
import { useSettingValue } from '@/store/setting/hook'
import { togetherRoomFeed } from '@/store/together/roomFeed'
import { useLuxTheme, sharedLuxStyles } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { createStyle, toast } from '@/utils/tools'

const emojis = ['👍', '❤️', '🔥', '😂']
const useStyles = sharedLuxStyles(colors => {
  const r = magazineRoles(colors)
  return createStyle({
    root: { flex: 1 },
    message: { flexDirection: 'row', gap: 8, marginVertical: 8 },
    avatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: r.accentSoft, overflow: 'hidden' },
    bubble: { borderRadius: 6, paddingVertical: 7, paddingHorizontal: 11, marginTop: 2, backgroundColor: r.onInk },
    system: { textAlign: 'center', marginVertical: 8 },
    reactions: { flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },
    stream: { minHeight: 300, paddingBottom: 12 },
    request: { flexDirection: 'row', alignItems: 'center', gap: 10, borderLeftWidth: 3, borderLeftColor: r.accent, borderTopRightRadius: 6, borderBottomRightRadius: 6, backgroundColor: r.onInk, paddingVertical: 6, paddingHorizontal: 10, marginVertical: 8 },
    cover: { width: 36, height: 36, borderRadius: 4, backgroundColor: r.placeholder },
    composer: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 2, borderTopColor: r.ink, paddingTop: 12, paddingBottom: 22, marginTop: 16 },
    floating: { position: 'absolute', right: 0, bottom: 0, width: 100, height: 180, overflow: 'hidden' },
  })
})

export const performRoomAction = async(action: () => Promise<unknown>, failure: string) => {
  try {
    const result = await action()
    if (result === false) toast(failure)
    return result !== false
  } catch { toast(failure); return false }
}

function FloatingEmoji({ item, index }: { item: FloatingReaction, index: number }) {
  const progress = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const animation = Animated.timing(progress, { toValue: 1, duration: FLOATING_REACTION_TTL, easing: Easing.out(Easing.cubic), useNativeDriver: true })
    animation.start()
    return () => { animation.stop() }
  }, [progress])
  return <Animated.View pointerEvents="none" style={{ position: 'absolute', bottom: 0, right: (index % 3) * 28, opacity: progress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }), transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -150] }) }] }}><Text size={26}>{item.emoji}</Text></Animated.View>
}

function FloatingReactions({ feed }: { feed: RoomFeedState }) {
  const styles = useStyles()
  const [queue, setQueue] = useState<FloatingReaction[]>([])
  const seen = useRef(new Set(feed.entries.filter(entry => entry.kind == 'reaction').map(entry => entry.id)))
  useEffect(() => {
    const entries = feed.entries.filter(entry => entry.kind == 'reaction')
    const fresh = entries.filter(entry => !seen.current.has(entry.id))
    seen.current = new Set(entries.map(entry => entry.id))
    if (fresh.length) setQueue(previous => appendFloatingReactions(previous, fresh, Date.now()))
  }, [feed.entries])
  useEffect(() => {
    const timer = setInterval(() => { setQueue(previous => previous.length ? expireFloatingReactions(previous, Date.now()) : previous) }, 200)
    return () => { clearInterval(timer) }
  }, [])
  return <View pointerEvents="none" style={styles.floating}>{queue.map((item, index) => <FloatingEmoji key={item.id} item={item} index={index} />)}</View>
}

export default function RoomFeedView({ feed, selfId, hostId, members, onRequests, header, topInset, bottomInset }: {
  header: (openMembers: () => void) => ReactNode
  topInset: number
  bottomInset: number
  feed: RoomFeedState
  selfId: string | null
  hostId: string
  members: ReactNode
  onRequests: () => void
}) {
  const styles = useStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const t = useI18n()
  const layout = resolveTogetherLayout(useSettingValue('together.roomLayout'))
  const [tab, setTab] = useState('chat')
  const [membersVisible, setMembersVisible] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const tabs = roomUiTabs(feed)
  const activeTab = tabs.includes(tab) ? tab : tabs[0]
  const isStream = layout == '6B'
  const canManage = selfId == hostId
  const fail = t('together_action_failed')
  const reaction = (emoji: string) => { void performRoomAction(async() => togetherRoomFeed.sendReaction(emoji), fail) }
  const renderEntry = (entry: TimelineEntry) => {
    if (entry.kind == 'reaction') return null
    if (entry.kind == 'system') {
      const name = feed.members.find(member => member.memberId == entry.memberId)?.displayName ?? t('together_role_member')
      return <Text key={entry.id} size={12} color={r.muted} style={styles.system}>— {entry.event == 'songChange' ? t('together_song_changed', { song: entry.song?.name ?? t('invite_no_song') }) : t(entry.event == 'join' ? 'together_member_joined' : 'together_member_left', { name })} —</Text>
    }
    if (entry.kind == 'request') {
      return isStream ? <View key={entry.id} style={styles.request}>
      <Image url={entry.request.song.meta.picUrl ?? ''} style={styles.cover} />
      <View style={{ flex: 1 }}><Text size={15} color={r.list} style={{ fontWeight: '700' }}>{t('together_requested_song', { name: entry.request.requestedBy.displayName, song: entry.request.song.name })}</Text><Text size={12} color={r.muted}>{t(`together_request_status_${entry.status ?? 'removed'}`)}</Text></View>
      {canManage && entry.status == 'pending' ? <SecondaryButton compact label={t('together_request_top')} onPress={() => { void performRoomAction(async() => togetherRoomFeed.reorderRequests([entry.request.id, ...feed.pendingRequests.filter(item => item.id != entry.request.id).map(item => item.id)]), fail) }} /> : null}
    </View> : <Text key={entry.id} size={12} color={r.muted} style={styles.system}>— {t('together_requested_song', { name: entry.request.requestedBy.displayName, song: entry.request.song.name })} —</Text>
    }
    const own = entry.message.senderId == selfId
    const member = feed.members.find(item => item.memberId == entry.message.senderId)
    return <View key={entry.id} style={[styles.message, own ? { flexDirection: 'row-reverse' } : null]}>
      <View style={styles.avatar}>{member?.avatar ? <Image url={member.avatar} style={{ width: 26, height: 26 }} /> : null}</View>
      <View style={{ maxWidth: '80%', alignItems: own ? 'flex-end' : 'flex-start' }}>
        <Text size={12} color={r.muted}>{entry.message.displayName}</Text>
        <View style={[styles.bubble, own ? { backgroundColor: r.ink } : null]}><Text size={14} color={own ? r.onInk : r.ink}>{entry.message.text}</Text></View>
        {entry.delivery == 'pending' ? <Text size={12} color={r.muted}>{t('together_chat_sending')}</Text> : null}
        {entry.delivery == 'failed' ? <TextButton compact label={t('together_chat_retry')} onPress={() => { void performRoomAction(async() => togetherRoomFeed.retry(entry.id), fail) }} /> : null}
      </View>
    </View>
  }
  const entries = selectRoomTimeline(feed)
  return <View style={[styles.root, { paddingBottom: bottomInset }]}>
    <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingTop: topInset, paddingBottom: 16, flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
    {header(() => { if (isStream) setMembersVisible(value => !value); else setTab('members') })}
    <View style={{ marginTop: 12 }}>
    {isStream ? <SectionHeader title={t('together_activity')} meta={t('together_activity_meta')} compactRule /> : <TextTabs value={activeTab} onChange={setTab} tabStyle={{ paddingVertical: 8 }} items={tabs.map(id => ({ id, label: id == 'requests' ? `${t('together_requests')} ${feed.pendingRequests.length}` : t(id == 'chat' ? 'together_chat' : 'together_members') }))} />}
    {isStream || activeTab == 'chat' ? <>
      <View style={isStream ? styles.stream : undefined}>
        {!isStream && feed.capabilities.chat ? <Text size={12} color={r.muted} style={styles.system}>{t('together_chat_history')}</Text> : null}
        {feed.capabilities.chat && feed.hasMore ? <TextButton compact label={t('together_chat_older')} disabled={feed.loading} onPress={() => { void togetherRoomFeed.loadOlder() }} /> : null}
        {feed.historyError ? <Text size={12} color={r.danger}>{t('together_history_failed')}</Text> : null}
        {entries.map(renderEntry)}
        {!isStream && feed.capabilities.reactions ? <View style={styles.reactions}>{emojis.map(emoji => <SecondaryButton key={emoji} compact label={`${emoji} ${feed.entries.filter(entry => entry.kind == 'reaction' && entry.reaction.emoji == emoji).length || ''}`} labelSize={13} style={{ paddingHorizontal: 14 }} onPress={() => { reaction(emoji) }} />)}</View> : null}
      </View>

    </> : null}
    {!isStream && activeTab == 'requests' ? <View style={{ marginVertical: 16 }}><SecondaryButton compact label={`${t('together_requests')} ${feed.pendingRequests.length}`} onPress={onRequests} /></View> : null}
    {(isStream ? membersVisible : activeTab == 'members') ? members : null}
    </View>
    </ScrollView>
    {isStream && feed.capabilities.reactions ? <View pointerEvents="box-none" style={{ position: 'absolute', right: 22, bottom: bottomInset + 108, width: 44, gap: 8 }}>{emojis.map(emoji => <SecondaryButton key={emoji} label={emoji} labelSize={18} style={{ width: 40, height: 40, paddingHorizontal: 0 }} onPress={() => { reaction(emoji) }} />)}</View> : null}
    {isStream && feed.capabilities.reactions ? <View pointerEvents="none" style={{ position: 'absolute', right: 66, bottom: bottomInset + 90, width: 100, height: 180, overflow: 'hidden' }}><FloatingReactions key={feed.roomId} feed={feed} /></View> : null}
    {isStream || activeTab == 'chat' ? <View style={{ paddingHorizontal: 22 }}>      {feed.capabilities.chat || (isStream && feed.capabilities.requests) ? <View style={styles.composer}>
        {isStream && feed.capabilities.requests ? <SecondaryButton compact label={`♪ ${t('together_requests')}`} style={{ paddingHorizontal: 12 }} onPress={onRequests} /> : !isStream && feed.capabilities.reactions ? <Text size={20} color={r.ink}>☺</Text> : null}
        {feed.capabilities.chat ? <><View style={{ flex: 1 }}><UnderlineInput value={draft} onChangeText={setDraft} placeholder={t('together_chat_placeholder')} maxLength={500} accessibilityLabel={t('together_chat')} /></View><PrimaryButton compact labelSize={13} label={t('together_chat_send')} disabled={!draft.trim() || sending} onPress={() => {
          const text = draft
          setSending(true)
          void togetherRoomFeed.sendChat(text).then(id => { if (id) setDraft(current => current == text ? '' : current) }).catch(() => { toast(fail) }).finally(() => { setSending(false) })
        }} /></> : null}
      </View> : null}</View> : null}
  </View>
}
