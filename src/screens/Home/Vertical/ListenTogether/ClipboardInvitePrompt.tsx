import { useEffect, useState } from 'react'
import { AppState, View } from 'react-native'
import Clipboard from '@react-native-clipboard/clipboard'
import Text from '@/components/common/Text'
import { MagDialog, PrimaryButton, SecondaryButton, TextButton } from '@/components/magazine'
import { createInviteController, type InvitePreferences } from '@/core/together/inviteController'
import { type TogetherInvite } from '@/core/together/inviteCode'
import { joinTogetherRoom } from '@/core/together'
import { getData, saveData } from '@/plugins/storage'
import { getLuxAuth } from '@/utils/data'
import { getSession, subscribeSession } from '@/plugins/sync/client/session'
import { subscribeTogether } from '@/store/together/action'
import togetherState from '@/store/together/state'
import { useI18n } from '@/lang'
import { useLuxTheme, sharedLuxStyles } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { createStyle, toast } from '@/utils/tools'

const KEY = 'lux.clipboardInvites.v1'
const useStyles = sharedLuxStyles(colors => {
  const r = magazineRoles(colors)
  return createStyle({
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
    cover: { width: 48, height: 48, borderRadius: 4, backgroundColor: r.accentSoft },
    info: { flex: 1 },
    title: { fontWeight: '700' },
    meta: { marginTop: 2 },
    hint: { lineHeight: 18 },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  })
})
export default function ClipboardInvitePrompt() {
  const [invite, setInvite] = useState<TogetherInvite | null>(null)
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const styles = useStyles()
  const t = useI18n()
  const [controller] = useState(() => createInviteController({
    load: async() => getData<InvitePreferences>(KEY),
    save: async value => { await saveData(KEY, value) },
    read: async() => Clipboard.getString(),
    changed: setInvite,
    gate: async() => {
      const auth = await getLuxAuth()
      return { loggedIn: !!auth, connected: getSession()?.state == 'togetherReady', supported: getSession()?.state != 'togetherUnsupported', serverId: auth?.serverId, currentRoomId: togetherState.room?.roomId, busy: togetherState.pending }
    },
    join: async value => {
      const result = await joinTogetherRoom(value.code, value.serverId, value.roomId)
      if (!result.ok && result.message) toast(result.message, 'long')
      if (result.ok) global.app_event.openListenTogether()
      return result.ok
    },
  }))
  useEffect(() => {
    const run = (work: Promise<void>) => { void work.catch(() => {}) }
    // One read per foreground transition. Never poll or read from a background handler.
    let active = AppState.currentState == 'active'
    run(controller.foreground(active))
    const app = AppState.addEventListener('change', value => {
      const next = value == 'active'
      if (next === active) return
      active = next
      run(controller.foreground(next))
    })
    const session = subscribeSession(() => { run(controller.pump()) })
    const room = subscribeTogether(() => { run(controller.pump()) })
    return () => { app.remove(); session(); room(); run(controller.foreground(false)) }
  }, [controller])
  // The global host must leave the Dock completely unobstructed when idle.
  if (!invite) return null
  const dismiss = () => { void controller.dismiss().catch(() => {}) }
  return (
    <MagDialog clipboardLayout visible={invite != null} onClose={dismiss} eyebrow={t('invite_detected')} title={t('invite_join_title', { name: invite?.host ?? t('invite_host') })}>
      <View style={styles.row}>
        <View style={styles.cover} />
        <View style={styles.info}>
          <Text size={15} color={r.list} style={styles.title}>{t('invite_playing', { song: invite?.song ?? t('invite_no_song') })}</Text>
          <Text size={12} color={r.muted} style={styles.meta}>{t('invite_room_meta', { code: invite?.code ?? '', count: invite?.members ?? '—' })}</Text>
        </View>
      </View>
      <Text size={12} color={r.muted} style={styles.hint}>{t('invite_follow_hint')}</Text>
      <View style={styles.actions}>
        <TextButton compact style={{ minHeight: 28 }} underline={false} label={t('invite_ignore')} onPress={dismiss} />
        <View style={{ flex: 1 }} />
        <SecondaryButton compact label={t('invite_never')} onPress={() => { void controller.dismiss(true).catch(() => {}) }} />
        <PrimaryButton compact labelSize={13} label={t('invite_join')} onPress={() => { void controller.accept().catch(() => {}) }} />
      </View>
    </MagDialog>
  )
}
