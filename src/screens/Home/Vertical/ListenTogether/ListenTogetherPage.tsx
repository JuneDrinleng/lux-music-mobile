/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { useCallback, useEffect, useState } from 'react'
import { Animated, ScrollView, TouchableOpacity, View, useWindowDimensions } from 'react-native'

import Image from '@/components/common/Image'
import Text from '@/components/common/Text'
import { useOverlaySlideTransition } from '@/components/common/overlaySlideTransition'
import {
  BackButton,
  Hairline,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
  StatusChip,
  TextButton,
  UnderlineInput,
} from '@/components/magazine'
import {
  closeTogetherRoom,
  createTogetherRoom,
  joinTogetherRoom,
  leaveTogetherRoom,
} from '@/core/together'
import { useI18n } from '@/lang'
import { formatTogetherGateHint } from '@/core/together/togetherGate'
import { useShowTogetherDebugPanel } from '@/core/together/useTogetherDebugPanel'
import { useTogetherGateSnapshot } from '@/core/together/useTogetherGateSnapshot'
import { useTogether } from '@/store/together/hook'
import TogetherDebugPanel from '@/screens/Home/Vertical/ListenTogether/TogetherDebugPanel'
import InviteSheet from './InviteSheet'
import RoomFeedView, { performRoomAction } from './RoomFeedView'
import RequestSheet from './RequestSheet'
import SearchPage from '../SearchPage'
import { togetherRoomFeed } from '@/store/together/roomFeed'
import { useTogetherRoomFeed } from '@/store/together/useRoomFeed'
import { shouldMountRequestSheet } from '@/core/together/roomUi'
import { selectRequestQueueModel } from '@/core/together/roomFeed'
import { togglePlay } from '@/core/player/player'
import TogetherReadinessPanel from '@/screens/Home/Vertical/ListenTogether/TogetherReadinessPanel'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { H1_AFTER_TOP, PAGE_GUTTER, SECTION_TO_LIST, TOP_BAR_MARGIN_TOP, magType } from '@/theme/magazineType'
import { useStatusbarHeight } from '@/store/common/hook'
import { useBackHandler } from '@/utils/hooks/useBackHandler'
import { clipboardWriteText, createStyle, toast } from '@/utils/tools'

const useStyles = sharedLuxStyles((colors) => {
  const r = magazineRoles(colors)
  return createStyle({
    root: { flex: 1, backgroundColor: r.paper },
    content: { paddingHorizontal: PAGE_GUTTER },
    topBar: { minHeight: 40, flexDirection: 'row', alignItems: 'center', marginTop: TOP_BAR_MARGIN_TOP },
    pageTitle: { fontWeight: '800', letterSpacing: -1, marginTop: H1_AFTER_TOP, lineHeight: 44 },
    codeRow: { flexDirection: 'row', alignItems: 'baseline', gap: 12, marginTop: 8 },
    codeDigits: { fontWeight: '800', letterSpacing: 8, fontVariant: ['tabular-nums'] },
    memberRow: {
      minHeight: 64,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      gap: 12,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: r.placeholder,
      overflow: 'hidden',
    },
    memberText: { flex: 1, minWidth: 0 },
    memberName: { fontWeight: '700' },
    actions: { gap: 12, marginTop: 24 },
    hint: { marginTop: 12, lineHeight: 20 },
    listBlock: { marginTop: SECTION_TO_LIST },
  })
})

export interface ListenTogetherPageProps {
  onClose: () => void
  bottomPadding?: number
}

const ListenTogetherPage = ({ onClose, bottomPadding = 0 }: ListenTogetherPageProps) => {
  const styles = useStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const t = useI18n()
  const statusBarHeight = useStatusbarHeight()
  const { width } = useWindowDimensions()
  const { style: sceneStyle, requestClose: animateClose } = useOverlaySlideTransition(width)
  const together = useTogether()
  const feed = useTogetherRoomFeed()
  const [requestsOpen, setRequestsOpen] = useState(false)
  const [pickingSong, setPickingSong] = useState(false)
  useEffect(() => { setRequestsOpen(false); setPickingSong(false) }, [together.room?.roomId])
  useEffect(() => {
    if (!feed.capabilities.requests) { setRequestsOpen(false); setPickingSong(false) }
  }, [feed.capabilities.requests])
  const showDebugPanel = useShowTogetherDebugPanel()
  const gateSnap = useTogetherGateSnapshot(showDebugPanel)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState<string | undefined>()

  const requestClose = useCallback(() => {
    animateClose(onClose)
  }, [animateClose, onClose])

  useBackHandler(useCallback(() => {
    if (pickingSong) setPickingSong(false)
    else if (requestsOpen) setRequestsOpen(false)
    else requestClose()
    return true
  }, [requestClose, pickingSong, requestsOpen]))

  const handleCreate = useCallback(async() => {
    const result = await createTogetherRoom()
    if (!result.ok && result.message) toast(result.message, 'long')
  }, [])

  const handleJoin = useCallback(async() => {
    setJoinError(undefined)
    const result = await joinTogetherRoom(joinCode)
    if (!result.ok) {
      setJoinError(result.message || t('together_code_invalid'))
      return
    }
    setJoinCode('')
  }, [joinCode, t])

  const handleCopyCode = useCallback(() => {
    const code = together.room?.code
    if (!code) return
    clipboardWriteText(code)
    toast(t('together_copied'))
  }, [t, together.room?.code])

  const handleLeave = useCallback(async() => {
    const result = await leaveTogetherRoom()
    if (!result.ok && result.message) toast(result.message, 'long')
    else requestClose()
  }, [requestClose])

  const handleCloseRoom = useCallback(async() => {
    const result = await closeTogetherRoom()
    if (!result.ok && result.message) toast(result.message, 'long')
    else requestClose()
  }, [requestClose])

  const room = together.room
  const isHost = together.role == 'host'

  return (
    <Animated.View style={[styles.root, sceneStyle]}>
      {room ? <RoomFeedView key={room.roomId} feed={feed} selfId={together.selfId} hostId={room.hostId} topInset={statusBarHeight} bottomInset={bottomPadding}
        onRequests={() => { setRequestsOpen(true) }}
        header={openMembers => <>
          <View style={styles.topBar}><BackButton onPress={requestClose} /><View style={{ flex: 1 }} />{together.connection == 'online' ? <SecondaryButton compact label={t('invite_entry')} onPress={() => { setInviteOpen(true) }} /> : null}</View>
          <Text size={11} color={r.eyebrow} style={{ marginTop: 6, letterSpacing: 2, fontWeight: '700' }}>{t('together_room_eyebrow', { code: room.code })}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text size={26} color={r.display} style={{ fontWeight: '800', lineHeight: 38, flexShrink: 1 }}>{t('together_room_name', { name: room.members.find(member => member.memberId == room.hostId)?.displayName ?? t('invite_host') })}</Text>
            <View style={{ flexDirection: 'row' }}>{room.members.slice(0, 3).map(member => <View key={member.memberId} style={{ width: 26, height: 26, borderRadius: 13, overflow: 'hidden', backgroundColor: r.accentSoft, marginLeft: -6 }}>{member.avatar ? <Image url={member.avatar} style={{ width: 26, height: 26 }} /> : null}</View>)}</View>
            <TouchableOpacity onPress={openMembers} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('together_members')} style={{ minHeight: 28, justifyContent: 'center' }}><Text size={12} color={r.muted}>{t('together_room_people', { count: room.members.length })}</Text></TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 }}>
            <Image url={room.playback.musicInfo?.meta.picUrl ?? ''} style={{ width: 48, height: 48, borderRadius: 4, backgroundColor: r.placeholder }} />
            <View style={{ flex: 1 }}><Text size={17} color={r.ink} style={{ fontWeight: '800' }} numberOfLines={1}>{room.playback.musicInfo?.name ?? t('invite_no_song')}</Text><Text size={12} color={r.muted}>{room.playback.musicInfo?.singer ?? ''} · {Math.floor(room.playback.positionMs / 60000)}:{String(Math.floor(room.playback.positionMs / 1000) % 60).padStart(2, '0')} / {Math.floor(room.playback.durationMs / 60000)}:{String(Math.floor(room.playback.durationMs / 1000) % 60).padStart(2, '0')}</Text></View>
            <PrimaryButton compact label="" accessibilityLabel={t(room.playback.isPlaying ? 'together_pause' : 'together_play')} icon={room.playback.isPlaying ? 'pause' : 'play'} style={{ width: 44, height: 44, paddingHorizontal: 0 }} disabled={!isHost} onPress={togglePlay} />
          </View>
          {together.connection != 'online' ? <Text size={14} color={r.muted} style={styles.hint}>{t(together.connection == 'unsupported' ? 'together_unsupported' : 'together_offline')}</Text> : null}
          {showDebugPanel && gateSnap ? <Text size={11} color={r.quiet} style={[styles.hint, { fontVariant: ['tabular-nums'] }]} selectable>{formatTogetherGateHint(gateSnap)}</Text> : null}
        </>}
        members={<>
              <SectionHeader title={t('together_invite_code')} showRule={false} headGap={18} />
              <View style={styles.codeRow}>
                <Text size={36} color={r.display} style={styles.codeDigits}>{room.code}</Text>
                <TextButton label={t('together_copy_code')} onPress={handleCopyCode} />
              </View>
              <Text size={12} color={r.muted} style={styles.hint}>
                {isHost ? t('together_you_are_host') : t('together_role_member')}
                {' · '}
                {t('together_members_count', { count: room.members.length, max: room.maxMembers })}
              </Text>

              <SectionHeader title={t('together_members')} meta={t('together_members_online', { count: room.members.filter(m => m.online).length })} />
              <View style={styles.listBlock}>
                {room.members.map((member, index) => (
                  <View key={member.memberId}>
                    <View style={styles.memberRow}>
                      <View style={styles.avatar}>
                        {member.avatar
                          ? <Image url={member.avatar} style={{ width: 40, height: 40, borderRadius: 20 }} />
                          : null}
                      </View>
                      <View style={styles.memberText}>
                        <Text size={16} color={r.ink} style={styles.memberName} numberOfLines={1}>
                          {member.displayName || member.username}
                          {member.memberId == room.hostId ? ` · ${t('together_role_host')}` : ''}
                        </Text>
                        <Text size={12} color={r.muted} numberOfLines={1}>{member.deviceName}</Text>
                      </View>
                      {member.online
                        ? <StatusChip label={t('together_online')} small />
                        : <Text size={12} color={r.quiet}>{t('together_offline_member')}</Text>}
                    </View>
                    {index < room.members.length - 1 ? <Hairline /> : null}
                  </View>
                ))}
              </View>

              <View style={styles.actions}>
                {isHost
                  ? <PrimaryButton label={t('together_close_room')} onPress={handleCloseRoom} danger disabled={together.pending} />
                  : null}
                <SecondaryButton label={t('together_leave')} onPress={handleLeave} disabled={together.pending} />
              </View>
        </>}
      /> : (
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: statusBarHeight, paddingBottom: 72 + bottomPadding }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topBar}>
          <BackButton onPress={requestClose} />
          <View style={{ flex: 1 }} />
          {together.room && together.connection == 'online' ? <SecondaryButton compact label={t('invite_entry')} onPress={() => { setInviteOpen(true) }} /> : null}
        </View>

        <Text size={magType.h1.size} color={r.display} style={styles.pageTitle}>{t('together_title')}</Text>

        {together.connection == 'offline'
          ? <Text size={14} color={r.muted} style={styles.hint}>{t('together_offline')}</Text>
          : null}
        {together.connection == 'unsupported'
          ? <Text size={14} color={r.muted} style={styles.hint}>{t('together_unsupported')}</Text>
          : null}
        {showDebugPanel && gateSnap
          ? (
            <Text size={11} color={r.quiet} style={[styles.hint, { fontVariant: ['tabular-nums'] }]} selectable>
              {formatTogetherGateHint(gateSnap)}
            </Text>
            )
          : null}

            <>
              <Text size={14} color={r.muted} style={[styles.hint, { marginTop: 12 }]}>{t('together_intro')}</Text>
              <TogetherReadinessPanel uiConnection={together.connection} />
              <View style={styles.actions}>
                <PrimaryButton
                  label={t('together_create_room')}
                  icon="account-multiple-outline"
                  onPress={handleCreate}
                  disabled={together.pending || together.connection != 'online'}
                />
              </View>
              <SectionHeader title={t('together_join_section')} showRule compactRule />
              <UnderlineInput
                label={t('together_invite_code')}
                value={joinCode}
                onChangeText={(text) => {
                  setJoinCode(text.replace(/\s/g, ''))
                  setJoinError(undefined)
                }}
                placeholder="123456"
                keyboardType="number-pad"
                maxLength={6}
                error={joinError}
                large
              />
              <View style={[styles.actions, { marginTop: 16 }]}>
                <SecondaryButton
                  label={t('together_join_room')}
                  onPress={handleJoin}
                  disabled={together.pending || together.connection != 'online'}
                />
              </View>
            </>
      </ScrollView>)}
      {room && shouldMountRequestSheet(requestsOpen, feed.capabilities.requests, feed.roomId) ? <RequestSheet feed={feed} selfId={together.selfId} hostId={room.hostId} bottomInset={bottomPadding} onClose={() => { setRequestsOpen(false) }} onPickSong={() => { setRequestsOpen(false); setPickingSong(true) }} /> : null}
      {room && pickingSong && feed.capabilities.requests ? <SearchPage visible covered={false} request={null} onClose={() => { setPickingSong(false); setRequestsOpen(true) }} onSelectSong={async(song) => {
        const model = selectRequestQueueModel(togetherRoomFeed.getSnapshot(), together.selfId, room.hostId)
        if (!model.canRequest) { toast(t('together_request_limit_reached')); return }
        const ok = await performRoomAction(async() => togetherRoomFeed.addRequest(song), t('together_action_failed'))
        if (ok && togetherRoomFeed.getSnapshot().roomId == room.roomId && togetherRoomFeed.getSnapshot().capabilities.requests) { setPickingSong(false); setRequestsOpen(true) }
      }} /> : null}
      <InviteSheet visible={inviteOpen} onClose={() => { setInviteOpen(false) }} />
      <TogetherDebugPanel visible={showDebugPanel} gateSnap={gateSnap} />
    </Animated.View>
  )
}

export default ListenTogetherPage
