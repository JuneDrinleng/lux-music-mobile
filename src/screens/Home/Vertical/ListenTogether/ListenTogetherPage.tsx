/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { useCallback, useState } from 'react'
import { Animated, ScrollView, View, useWindowDimensions } from 'react-native'

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
import { useTogether } from '@/store/together/hook'
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
  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState<string | undefined>()

  const requestClose = useCallback(() => {
    animateClose(onClose)
  }, [animateClose, onClose])

  useBackHandler(useCallback(() => {
    requestClose()
    return true
  }, [requestClose]))

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
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: statusBarHeight, paddingBottom: 72 + bottomPadding }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topBar}>
          <BackButton onPress={requestClose} />
        </View>

        <Text size={magType.h1.size} color={r.display} style={styles.pageTitle}>{t('together_title')}</Text>

        {together.connection == 'offline'
          ? <Text size={14} color={r.muted} style={styles.hint}>{t('together_offline')}</Text>
          : null}
        {together.connection == 'unsupported'
          ? <Text size={14} color={r.muted} style={styles.hint}>{t('together_unsupported')}</Text>
          : null}

        {room
          ? (
            <>
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
            </>
            )
          : (
            <>
              <Text size={14} color={r.muted} style={[styles.hint, { marginTop: 12 }]}>{t('together_intro')}</Text>
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
            )}
      </ScrollView>
    </Animated.View>
  )
}

export default ListenTogetherPage
