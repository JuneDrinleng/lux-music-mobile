import { useEffect, useState } from 'react'
import { ScrollView, Share, View } from 'react-native'
import Text from '@/components/common/Text'
import { MagazineSheet, PrimaryButton, SecondaryButton } from '@/components/magazine'
import { refreshRoom } from '@/core/together'
import { formatInviteText, formatInviteToken, type TogetherInvite } from '@/core/together/inviteCode'
import { useI18n } from '@/lang'
import { useTogether } from '@/store/together/hook'
import { useLuxTheme, sharedLuxStyles } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { getLuxAuth } from '@/utils/data'
import { clipboardWriteText, createStyle, toast } from '@/utils/tools'

const useStyles = sharedLuxStyles(colors => {
  const r = magazineRoles(colors)
  return createStyle({
    token: { marginTop: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: r.ink, borderRadius: 6, backgroundColor: r.onInk, padding: 14 },
    text: { lineHeight: 22 },
    hint: { marginTop: 10, lineHeight: 18 },
    footer: { borderTopWidth: 2, borderTopColor: r.ink, marginHorizontal: -22, paddingHorizontal: 22, paddingTop: 12, paddingBottom: 26, flexDirection: 'row', gap: 16 },
  })
})
export default function InviteSheet({ visible, onClose }: { visible: boolean, onClose: () => void }) {
  const { room, connection } = useTogether()
  const [serverId, setServerId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const styles = useStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const t = useI18n()
  useEffect(() => {
    let current = true
    if (visible) void getLuxAuth().then(auth => { if (current) setServerId(auth?.serverId ?? null) }).catch(() => {})
    return () => { current = false }
  }, [visible])
  if (!room || connection != 'online') return null
  const host = room.members.find(member => member.memberId == room.hostId)
  const invite: TogetherInvite | null = serverId ? {
    code: room.code,
    serverId,
    roomId: room.roomId,
    host: host?.displayName ?? host?.username,
    song: room.playback.musicInfo?.name,
    members: room.members.length,
    ...(room.inviteExpiresAt != null ? { expiresAt: room.inviteExpiresAt } : {}),
  } : null
  const expired = invite?.expiresAt != null && invite.expiresAt <= Date.now()
  const shareText = invite && !expired ? formatInviteText(invite, t('invite_share_text', { name: invite.host ?? t('invite_host'), song: invite.song ?? t('invite_no_song') })) : ''
  const copy = async(share: boolean) => {
    if (!invite || !shareText) return
    clipboardWriteText(share ? shareText : formatInviteToken(invite))
    toast(t('together_copied'))
    if (share) await Share.share({ message: shareText }).catch(() => {})
  }
  return (
    <MagazineSheet visible={visible} onClose={onClose} heightRatio={470 / 844} inviteLayout eyebrow={t('invite_eyebrow')} title={t('invite_sheet_title')}
      meta={expired ? t('invite_expired') : invite?.expiresAt != null ? t('invite_expiry', { time: new Date(invite.expiresAt).toLocaleString() }) : t('invite_valid_room')}
      headerAction={{ text: t('invite_regenerate'), disabled: refreshing, onPress: () => { setRefreshing(true); void refreshRoom().finally(() => { setRefreshing(false) }) } }}
      footerContent={<View style={styles.footer}>
        <SecondaryButton compact label={t('invite_copy_token')} disabled={!shareText} onPress={() => { void copy(false) }} style={{ paddingHorizontal: 14 }} />
        <PrimaryButton compact labelSize={14} label={t('invite_copy_share')} disabled={!shareText} onPress={() => { void copy(true) }} style={{ flex: 1, paddingHorizontal: 8 }} />
      </View>}>
      <ScrollView>
        <View style={styles.token}><Text size={14} color={r.ink} style={styles.text} selectable>{shareText || (expired ? t('invite_expired') : '…')}</Text></View>
        <Text size={12} color={r.muted} style={styles.hint}>{t('invite_copy_hint')}</Text>
      </ScrollView>
    </MagazineSheet>
  )
}
