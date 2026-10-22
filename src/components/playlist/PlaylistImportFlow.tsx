/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import { useEffect, useMemo, useRef, useState } from 'react'
import { FlatList, Keyboard, KeyboardAvoidingView, Modal, Platform, ScrollView, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import ChoosePath, { type ChoosePathType } from '@/components/common/ChoosePath'
import PromptDialog, { type PromptDialogType } from '@/components/common/PromptDialog'
import { Checkbox, Hairline, MagazineSheet, MagazineSheetRow, MagTopBar, OptionRow, PrimaryButton, SecondaryButton, SourceTag, TextButton, TextTabs, Toggle, UnderlineInput } from '@/components/magazine'
import { addListMusics, createList, getListMusics } from '@/core/list'
import { useI18n } from '@/lang'
import { useStatusbarHeight } from '@/store/common/hook'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { createStyle } from '@/utils/tools'
import { readFile } from '@/utils/fs'
import useSystemGestureInsetBottom from '@/utils/hooks/useSystemGestureInsetBottom'
import { getActiveSpace, onDataSpaceChanged } from '@/utils/dataSpace'
import { pickMusicCover } from '@/utils/musicCover'
import { parseText, type ImportSource, type ImportTrack } from '@/utils/playlistImport/parser'
import { matchTracks, withImportDeadline } from '@/utils/playlistImport/matcher'
import { decodeCSV, loadPlatformSongs, searchImportSongs } from '@/utils/playlistImport/sdk'
import { chooseReviewSong, nextReviewCandidate, reviewRows, selectedImportSongs, toggleReviewSkipped, type ReviewRow } from '@/utils/playlistImport/review'
import { scoreTrack } from '@/utils/playlistImport/score'

type Song = LX.Music.MusicInfoOnline
type Row = ReviewRow<Song>
type InputTab = 'text' | 'csv' | 'platform'
const defaultSources: ImportSource[] = ['tx', 'wy', 'kg']

export default function PlaylistImportFlow({ initialTab = 'text', targetListId, targetListName, onClose, onImported, onLocalImport }: {
  initialTab?: InputTab
  targetListId?: string
  targetListName?: string
  onClose: () => void
  onImported?: (id: string) => void
  onLocalImport?: () => void
}) {
  const t = useI18n()
  const styles = useStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const statusBar = useStatusbarHeight()
  const inset = useSystemGestureInsetBottom()
  const [space] = useState(getActiveSpace)
  const [tab, setTab] = useState<InputTab>(initialTab)
  const [text, setText] = useState('')
  const [link, setLink] = useState('')
  const [csv, setCsv] = useState<{ name: string, tracks: ImportTrack[], encoding: string } | null>(null)
  const [sources, setSources] = useState<ImportSource[]>(defaultSources)
  const [sourcePicker, setSourcePicker] = useState(false)
  const [skipExisting, setSkipExisting] = useState(true)
  const [existing, setExisting] = useState<LX.Music.MusicInfo[]>([])
  const [rows, setRows] = useState<Row[] | null>(null)
  const [statusTab, setStatusTab] = useState('uncertain')
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [manualIndex, setManualIndex] = useState<number | null>(null)
  const [manualQuery, setManualQuery] = useState('')
  const [manualSongs, setManualSongs] = useState<Song[]>([])
  const [manualBusy, setManualBusy] = useState(false)
  const controller = useRef<AbortController | null>(null)
  const manualController = useRef<AbortController | null>(null)
  const alive = useRef(true)
  const savingRef = useRef(false)
  const choosePath = useRef<ChoosePathType>(null)
  const createName = useRef<PromptDialogType>(null)
  const tracks = useMemo(() => tab === 'csv' ? csv?.tracks ?? [] : parseText(text), [tab, csv, text])
  const chosenSongs = useMemo(() => selectedImportSongs(rows ?? [], existing, skipExisting), [rows, existing, skipExisting])
  const valid = () => alive.current && getActiveSpace() === space

  useEffect(() => {
    alive.current = true
    const unsubscribe = onDataSpaceChanged(() => { controller.current?.abort(); manualController.current?.abort(); onClose() })
    if (targetListId) void getListMusics(targetListId).then(songs => { if (alive.current && getActiveSpace() === space) setExisting(songs) }).catch(() => { if (alive.current) setError(t('import_error')) })
    return () => { alive.current = false; controller.current?.abort(); manualController.current?.abort(); unsubscribe() }
  }, [targetListId, space, onClose, t])

  const close = () => {
    if (savingRef.current) return
    if (manualIndex != null) { manualController.current?.abort(); setManualIndex(null); return }
    if (sourcePicker) { setSourcePicker(false); return }
    controller.current?.abort()
    if (busy) { setBusy(false); setError(''); return }
    if (rows) { setRows(null); return }
    onClose()
  }
  const readCSV = async(path: string) => {
    setError('')
    try {
      const content = await readFile(path, 'base64')
      if (!valid()) return
      const parsed = decodeCSV(String(content))
      setCsv({ name: path.split('/').pop() ?? '', ...parsed })
    } catch { if (valid()) { setCsv(null); setError(t('import_csv_error')) } }
  }
  const start = async() => {
    if (busy || (tab !== 'platform' && !tracks.length)) return
    Keyboard.dismiss(); setError(''); setBusy(true); setProgress(0)
    const run = new AbortController(); controller.current = run
    try {
      let result: Row[]
      if (tab === 'platform') {
        const songs = await withImportDeadline(async() => loadPlatformSongs(link, run.signal), run.signal)
        if (run.signal.aborted) return
        if (!songs.length) { setError(t('import_no_results')); return }
        result = reviewRows(songs.map(song => ({ track: { title: song.name, artist: song.singer, original: `${song.name} - ${song.singer}` }, candidates: [{ song, score: 100 }], status: 'matched' })))
      } else {
        result = reviewRows(await matchTracks(tracks, { sources, signal: run.signal, search: searchImportSongs, onProgress: (_, completed) => { if (valid() && !run.signal.aborted) setProgress(completed) } }))
      }
      if (!valid() || run.signal.aborted) return
      setRows(result)
      setStatusTab(result.some(row => row.status === 'uncertain') ? 'uncertain' : result.some(row => row.status === 'unmatched') ? 'unmatched' : 'all')
    } catch { if (valid() && !run.signal.aborted) setError(t('import_error')) } finally { run.abort(); if (valid() && controller.current === run) setBusy(false) }
  }
  const updateRow = (index: number, change: (row: Row) => Row) => { setRows(previous => previous?.map((row, i) => i === index ? change(row) : row) ?? null) }
  const openManual = (index: number) => {
    const row = rows?.[index]
    if (!row) return
    setManualBusy(false); setManualQuery(`${row.track.title} ${row.track.artist}`.trim()); setManualSongs([]); setManualIndex(index); setError('')
  }
  const searchManual = async() => {
    if (!manualQuery.trim()) return
    manualController.current?.abort()
    const run = new AbortController(); manualController.current = run
    setManualBusy(true); setManualSongs([]); setError('')
    try {
      const found = await matchTracks([{ original: manualQuery, title: manualQuery, artist: '' }], { sources, signal: run.signal, search: searchImportSongs, minimumScore: 0, candidateLimit: 90 })
      if (valid() && !run.signal.aborted) setManualSongs(found[0]?.candidates.map(candidate => candidate.song) ?? [])
    } catch { if (valid() && !run.signal.aborted) setError(t('import_error')) } finally { if (valid() && manualController.current === run) setManualBusy(false) }
  }
  const submit = async(name?: string): Promise<boolean> => {
    if (!rows || savingRef.current || !valid()) return false
    if (!targetListId && !name?.trim()) { createName.current?.show(''); return false }
    savingRef.current = true; setSaving(true); setError('')
    try {
      const latest = targetListId ? await getListMusics(targetListId) : []
      if (!valid()) return false
      const songs = selectedImportSongs(rows, latest, skipExisting)
      const id = targetListId ?? `userlist_import_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      if (!songs.length) { setExisting(latest); return false }
      if (targetListId) await addListMusics(id, songs, 'bottom')
      else await createList({ id, name: name?.trim(), list: songs })
      if (valid()) { onImported?.(id); onClose() }
      return true
    } catch { if (valid()) setError(t('import_error')); return false } finally { savingRef.current = false; if (valid()) setSaving(false) }
  }

  const recognizedParts = t('import_recognized', { num: '{count}' }).split('{count}')
  const statusItems = ['all', 'uncertain', 'unmatched', 'matched'].map(id => ({ id, label: t(`import_status_${id}` as 'import_status_all', { num: id === 'all' ? rows?.length ?? 0 : rows?.filter(row => row.status === id).length ?? 0 }) }))
  return <Modal visible animationType="slide" onRequestClose={close}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.root, { paddingTop: statusBar }]}>
      <FlatList
        data={rows?.map((row, index) => ({ row, index })).filter(({ row }) => statusTab === 'all' || row.status === statusTab) ?? []}
        keyExtractor={item => String(item.index)}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.page}
        ListHeaderComponent={<>
          <MagTopBar onBack={close} trailing={rows ? <TextButton compact label={t('import_accept_all')} disabled={saving} onPress={() => { setRows(previous => previous?.map(row => ({ ...row, selected: row.status !== 'unmatched' && row.candidates.length > 0, skipped: false })) ?? null) }} labelSize={15} style={{ paddingHorizontal: 0 }} /> : undefined} />
          <Text size={11} color={r.eyebrow} style={styles.eyebrow}>{rows ? t('import_review_eyebrow') : targetListName ? t('import_target', { name: targetListName }) : t('import_new_target')}</Text>
          <Text size={32} color={r.display} style={styles.title}>{rows ? t('import_review_title', { num: rows.length }) : t('import_paste_title')}</Text>
          <TextTabs items={rows ? statusItems : [{ id: 'text', label: t('import_tab_text') }, { id: 'csv', label: t('import_tab_csv') }, { id: 'platform', label: t('import_tab_platform') }]} value={rows ? statusTab : tab} onChange={value => { if (rows) setStatusTab(value); else if (!busy) { setTab(value as InputTab); setError('') } }} scroll tabStyle={{ paddingTop: 8, paddingBottom: 8 }} style={{ marginTop: 10 }} />
          {!rows ? <>
            {tab === 'text' ? <UnderlineInput accessibilityLabel={t('import_tab_text')} multiline textAlignVertical="top" value={text} onChangeText={setText} editable={!busy} autoCorrect={false} autoCapitalize="none" placeholder={t('import_text_placeholder')} style={styles.textarea} /> : null}
            {tab === 'csv' ? <View style={styles.fileInput}><SecondaryButton compact label={t('import_choose_csv')} disabled={busy} onPress={() => { choosePath.current?.show({ title: t('import_choose_csv'), filter: ['csv'] }) }} />{csv ? <Text size={12} color={r.muted} style={{ marginTop: 8 }}>{csv.name} · {csv.encoding.toUpperCase()}</Text> : null}</View> : null}
            {tab === 'platform' ? <View style={{ marginTop: 14 }}><UnderlineInput accessibilityLabel={t('import_tab_platform')} value={link} onChangeText={setLink} editable={!busy} placeholder={t('import_link_placeholder')} autoCapitalize="none" autoCorrect={false} />{onLocalImport ? <TextButton compact label={t('import_from_local')} disabled={busy} onPress={onLocalImport} style={{ alignSelf: 'flex-start', marginTop: 14, paddingHorizontal: 0 }} /> : null}</View> : null}
            <Text size={12} color={r.muted} style={{ marginTop: 8 }}>{t(tab === 'platform' ? 'import_link_hint' : 'import_format_hint')}</Text>
            <View style={styles.rule} />
            <TouchableOpacity accessibilityRole="button" disabled={busy} style={styles.settingRow} onPress={() => { setSourcePicker(true) }}><View style={{ flex: 1 }}><Text size={15} color={r.list} style={styles.bold}>{t('import_sources')}</Text><Text size={12} color={r.muted} style={{ marginTop: 2 }}>{sources.join(' → ')}</Text></View><Text color={r.ink}>›</Text></TouchableOpacity>
            <View style={[styles.settingRow, { borderBottomWidth: 0 }]}><Text size={15} color={r.list} style={[styles.bold, { flex: 1 }]}>{t('import_skip_existing')}</Text><Toggle compact accessibilityLabel={t('import_skip_existing')} value={skipExisting} disabled={busy} onChange={setSkipExisting} /></View>
          </> : null}
          {error ? <Text accessibilityRole="alert" size={12} color={r.danger} style={{ marginTop: 8 }}>{error}</Text> : null}
        </>}
        renderItem={({ item: { row, index } }) => {
          const candidate = row.candidates[row.choice]
          const found = !row.skipped && candidate && (row.status !== 'unmatched' || row.choice > 0)
          return <View style={styles.reviewRow}>
            <Text size={12} color={r.muted}>{t('import_original', { text: row.track.original })}</Text>
            {found ? <MagazineSheetRow reviewLayout last title={candidate.song.name} coverUri={pickMusicCover(candidate.song)} subtitle={<View style={styles.subtitle}><SourceTag neutral source={candidate.song.source} label={candidate.song.source} /><Text size={12} color={r.muted} numberOfLines={1} style={{ flexShrink: 1 }}>{t('import_similarity', { artist: candidate.song.singer, num: candidate.score })}</Text></View>} trailing={<View style={styles.actions}>
              <SecondaryButton compact labelSize={13} label={t('import_next')} disabled={saving} onPress={() => {
                if (row.candidates.length < 2 || row.choice + 1 >= row.candidates.length) { openManual(index); return }
                updateRow(index, nextReviewCandidate)
              }} style={{ paddingHorizontal: 14 }} />
              <TouchableOpacity accessibilityRole="checkbox" accessibilityLabel={candidate.song.name} accessibilityState={{ checked: row.selected }} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} disabled={saving} onPress={() => { updateRow(index, old => ({ ...old, selected: !old.selected })) }}><Checkbox checked={row.selected} /></TouchableOpacity>
            </View>} /> : <View style={styles.unmatched}><Text size={15} color={r.quiet} style={[styles.bold, { flex: 1 }]}>{t(row.skipped ? 'import_skipped' : 'import_not_found')}</Text><SecondaryButton compact labelSize={13} style={{ paddingHorizontal: 14 }} label={t('import_manual')} disabled={saving} onPress={() => { openManual(index) }} /><SecondaryButton compact labelSize={13} style={{ paddingHorizontal: 14 }} label={t(row.skipped ? 'import_restore' : 'import_skip')} disabled={saving} onPress={() => { updateRow(index, toggleReviewSkipped) }} /></View>}
            <Hairline />
          </View>
        }}
      />
      <View style={[styles.footer, { paddingBottom: inset + 26 }]}>
        <Text size={12} color={r.muted} style={styles.bold}>{rows ? t('import_will_add', { num: chosenSongs.length }) : tab === 'platform' ? t('import_tab_platform') : <>{recognizedParts[0]}<Text size={18} color={r.ink} style={styles.bold}>{tracks.length}</Text>{recognizedParts[1]}</>}</Text>
        <PrimaryButton compact label={saving ? t('import_saving') : busy ? tab === 'platform' ? t('list_loading') : t('import_progress', { done: progress, total: tracks.length }) : rows ? t('list_import') : t('import_start')} badge={rows ? chosenSongs.length : undefined} labelSize={15} style={{ flex: 1 }} disabled={saving || busy || (rows ? !chosenSongs.length : tab === 'platform' ? !link.trim() : !tracks.length)} onPress={() => { if (rows) void submit(); else void start() }} />
      </View>
    </KeyboardAvoidingView>
    <MagazineSheet visible={sourcePicker} onClose={() => { setSourcePicker(false) }} title={t('import_sources')}>
      <ScrollView>{(['tx', 'wy', 'kg', 'kw', 'mg'] as const).map(source => <OptionRow key={source} label={source} description={sources.includes(source) ? String(sources.indexOf(source) + 1) : undefined} selected={sources.includes(source)} onPress={() => { setSources(previous => previous.includes(source) ? previous.length === 1 ? previous : previous.filter(item => item !== source) : [...previous, source]) }} />)}<Text size={12} color={r.muted}>{t('import_sources_hint')}</Text></ScrollView>
    </MagazineSheet>
    <MagazineSheet visible={manualIndex != null} onClose={() => { manualController.current?.abort(); setManualIndex(null) }} title={t('import_manual')}>
      <UnderlineInput accessibilityLabel={t('import_manual')} value={manualQuery} onChangeText={setManualQuery} returnKeyType="search" onSubmitEditing={() => { void searchManual() }} />
      <PrimaryButton compact label={manualBusy ? t('me_searching') : t('import_manual')} disabled={manualBusy || !manualQuery.trim()} onPress={() => { void searchManual() }} style={{ marginVertical: 16 }} />
      {error ? <Text size={12} color={r.danger}>{error}</Text> : null}
      {!manualBusy && !manualSongs.length ? <Text size={12} color={r.muted}>{t('import_search_hint')}</Text> : null}
      <FlatList data={manualSongs} keyExtractor={song => `${song.source}_${song.id}`} keyboardShouldPersistTaps="handled" renderItem={({ item }) => <MagazineSheetRow reviewLayout title={item.name} coverUri={pickMusicCover(item)} subtitle={`${item.singer} · ${item.source}`} onPress={() => {
        if (manualIndex == null) return
        updateRow(manualIndex, old => chooseReviewSong(old, item, scoreTrack(old.track, item))); setManualIndex(null)
      }} />} />
    </MagazineSheet>
    <ChoosePath ref={choosePath} onConfirm={path => { void readCSV(path) }} />
    <PromptDialog ref={createName} title={t('list_create')} placeholder={t('list_create_input_placeholder')} confirmText={t('list_import')} cancelText={t('cancel')} onConfirm={submit} />
  </Modal>
}
const useStyles = sharedLuxStyles(colors => {
  const r = magazineRoles(colors)
  return createStyle({
    root: { flex: 1, backgroundColor: r.paper },
    page: { paddingHorizontal: 22, paddingBottom: 24 },
    eyebrow: { marginTop: 6, fontWeight: '700', letterSpacing: 2 },
    title: { fontWeight: '800', lineHeight: 38 },
    textarea: { marginTop: 14, minHeight: 177, fontSize: 14, lineHeight: 24, fontWeight: '400', fontFamily: 'monospace', paddingTop: 0, paddingBottom: 8, borderBottomWidth: 1.5, borderBottomColor: r.ink },
    fileInput: { marginTop: 14, minHeight: 177, justifyContent: 'center', borderBottomWidth: 1.5, borderBottomColor: r.ink },
    rule: { height: 2, backgroundColor: r.ink, marginTop: 22, marginBottom: 12 },
    bold: { fontWeight: '700' },
    settingRow: { flexDirection: 'row', alignItems: 'center', minHeight: 56, borderBottomWidth: 1, borderBottomColor: r.hairline },
    footer: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 12, paddingHorizontal: 22, borderTopWidth: 2, borderTopColor: r.ink, backgroundColor: r.paper },
    reviewRow: { paddingTop: 10 },
    subtitle: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    unmatched: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingTop: 6, paddingBottom: 10 },
  })
})
