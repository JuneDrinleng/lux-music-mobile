/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { useEffect, useRef, useState } from 'react'
import { BackHandler, ScrollView, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import { Checkbox, MagazineSheet, OptionRow, PrimaryButton, SecondaryButton, TextButton, Toggle } from '@/components/magazine'
import { useStatusbarHeight } from '@/store/common/hook'
import { useI18n } from '@/lang'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { rgbaHex } from '@/theme/luxColorMath'
import { createStyle } from '@/utils/tools'
import { type ImportChoice, type SpaceContents } from '@/utils/dataSpace/operations'

export interface AccountDataDialogProps {
  kind: 'import' | 'logout'
  username: string
  host: string
  contents?: SpaceContents
  finish: (choice: ImportChoice | boolean | null) => Promise<void>
}

export default function AccountDataDialog({ kind, username, host, contents, finish }: AccountDataDialogProps) {
  const styles = useStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const t = useI18n()
  const statusHeight = useStatusbarHeight()
  const [sheet, setSheet] = useState(false)
  const [remove, setRemove] = useState(false)
  const [ids, setIds] = useState<string[]>([])
  const [history, setHistory] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  const run = async(choice: ImportChoice | boolean | null) => {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setError('')
    try { await finish(choice) } catch { setError(t('spaces_action_failed')) } finally { pending.current = false; setBusy(false) }
  }
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (pending.current) return true
      if (sheet) setSheet(false)
      else void run(null)
      return true
    })
    return () => { subscription.remove() }
  })
  const listName = (id: string, name: string) => name || t(id === 'love' ? 'spaces_list_love' : id === 'temp' ? 'spaces_list_temp' : 'spaces_list_default')
  return <View style={styles.root}>
    {kind === 'import' ? <View pointerEvents="none" style={[styles.successBackground, { backgroundColor: r.paper }]}><Text size={11} color={r.eyebrow} style={[styles.eyebrow, { marginTop: statusHeight + 10, marginLeft: 22 }]}>{t('spaces_login_success')}</Text><View style={[styles.successBackground, { backgroundColor: rgbaHex(r.ink, 0.42) }]} /></View> : null}
    <View style={styles.card} accessibilityViewIsModal>
      <Text size={11} color={r.eyebrow} style={styles.eyebrow}>{t(kind === 'import' ? 'spaces_import_eyebrow' : 'spaces_logout_eyebrow', { username, host: host.replace(/^https?:\/\//i, '').replace(/\/+$/, '') })}</Text>
      <Text size={20} color={r.ink} style={styles.title}>{t(kind === 'import' ? 'spaces_import_title' : 'spaces_logout_title', { username })}</Text>
      {kind === 'import' && contents ? <Text size={14} color={r.list} style={styles.body}>{t('spaces_import_body')}{'\n'}<Text size={14} color={r.list} style={styles.bold}>{t('spaces_import_counts', { lists: contents.lists.length, songs: contents.songs.toLocaleString(), history: contents.history.toLocaleString() })}</Text></Text> : <View style={styles.body}>
        <OptionRow leading label={t('spaces_keep')} description={t('spaces_keep_desc', { username })} selected={!remove} onPress={() => { setRemove(false) }} disabled={busy} />
        <OptionRow leading last label={t('spaces_delete')} description={t('spaces_delete_desc')} selected={remove} onPress={() => { setRemove(true) }} disabled={busy} />
      </View>}
      {error ? <Text size={12} color={r.danger} accessibilityLiveRegion="polite">{error}</Text> : null}
      <View style={styles.actions}>
        <View style={styles.flex}><TextButton compact underline={false} label={t(kind === 'import' ? 'spaces_no_import' : 'cancel')} disabled={busy} onPress={() => { void run(null) }} /></View>
        {kind === 'import' ? <SecondaryButton compact label={t('spaces_choose')} disabled={busy} style={styles.button} onPress={() => { setIds(contents?.lists.filter(list => list.id !== 'temp').map(list => list.id) ?? []); setSheet(true) }} /> : null}
        <PrimaryButton compact labelSize={13} labelStyle={styles.bold} style={styles.button} label={t(kind === 'import' ? 'spaces_import_all' : 'account_logout')} disabled={busy} onPress={() => { void run(kind === 'import' ? { ids: contents?.lists.map(list => list.id) ?? [], history: true, all: true } : remove) }} />
      </View>
    </View>
    {contents ? <MagazineSheet visible={sheet} onClose={() => { if (!busy) setSheet(false) }} heightRatio={640 / 844} eyebrow={t('spaces_sheet_eyebrow', { username })} title={t('spaces_sheet_title')} figure={{ value: String(ids.length), unit: t('spaces_sheet_total', { count: contents.lists.length }) }} meta={t('spaces_local_preserved')} headerAction={{ text: t('spaces_select_all'), disabled: busy, onPress: () => { setIds(ids.length === contents.lists.length ? [] : contents.lists.map(list => list.id)) } }} importLayout footerContent={<View style={styles.sheetFooter}>
        <TextButton compact underline={false} label={t('spaces_skip')} disabled={busy} onPress={() => { void run(null) }} />
        <View style={styles.flex}><PrimaryButton compact labelSize={13} label={t('spaces_import')} disabled={busy || (!ids.length && !history)} onPress={() => { void run({ ids, history }) }} badge={ids.length} /></View>
      </View>}>
      <ScrollView>
        {contents.lists.map(list => <TouchableOpacity key={list.id} disabled={busy} activeOpacity={0.7} accessibilityRole="checkbox" accessibilityState={{ checked: ids.includes(list.id), disabled: busy }} onPress={() => { setIds(previous => previous.includes(list.id) ? previous.filter(id => id !== list.id) : [...previous, list.id]) }} style={styles.listRow}>
          <Checkbox checked={ids.includes(list.id)} /><View style={styles.cover} /><View style={styles.flex}><Text size={15} color={r.list} style={styles.bold}>{listName(list.id, list.name)}</Text><Text size={12} color={r.muted} style={styles.subtitle}>{t('spaces_song_count', { count: list.count })}</Text></View>
        </TouchableOpacity>)}
        <View style={styles.listRow}><View style={styles.flex}><Text size={15} color={r.list} style={styles.bold}>{t('spaces_include_history')}</Text><Text size={12} color={r.muted} style={styles.subtitle}>{t('spaces_history_desc', { count: contents.history.toLocaleString() })}</Text></View><Toggle compact value={history} onChange={setHistory} disabled={busy} accessibilityLabel={t('spaces_include_history')} /></View>
      </ScrollView>
      {error ? <Text size={12} color={r.danger}>{error}</Text> : null}

    </MagazineSheet> : null}
  </View>
}

// Same centered card/scrim and type scale as 13E SessionExpiredDialog.
const useStyles = sharedLuxStyles(colors => {
  const r = magazineRoles(colors)
  return createStyle({
    root: { flex: 1, justifyContent: 'center', paddingHorizontal: 22, backgroundColor: rgbaHex(r.ink, 0.42) },
    successBackground: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
    card: { backgroundColor: r.paper, borderTopWidth: 2, borderTopColor: r.ink, borderRadius: 6, padding: 20 },
    eyebrow: { fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' },
    title: { fontWeight: '800', marginTop: 6 },
    body: { marginTop: 10, lineHeight: 21 },
    bold: { fontWeight: '700' },
    actions: { marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 10 },
    flex: { flex: 1, minWidth: 0 },
    button: { paddingHorizontal: 14 },
    listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, borderBottomWidth: 1, borderBottomColor: r.hairline },
    cover: { width: 34, height: 34, borderRadius: 8, backgroundColor: colors.surface.placeholder },
    subtitle: { marginTop: 2 },
    sheetFooter: { flexDirection: 'row', alignItems: 'center', gap: 16, borderTopWidth: 2, borderTopColor: r.ink, paddingTop: 12, paddingBottom: 26 },
  })
})
