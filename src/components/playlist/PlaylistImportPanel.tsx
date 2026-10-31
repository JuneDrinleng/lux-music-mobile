/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { useMemo, useState } from 'react'
import { FlatList, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import { MdiIcon } from '@/components/common/MdiIcon'
import { Checkbox, EmptyState, IconButton, MagazineSheetRow, PrimaryButton, SecondaryButton, SourceTag, TextButton, UnderlineInput } from '@/components/magazine'
import { LIST_IDS } from '@/config/constant'
import { useI18n } from '@/lang'
import { useMyList } from '@/store/list/hook'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { pickMusicCover } from '@/utils/musicCover'
import { createStyle } from '@/utils/tools'
import useSystemGestureInsetBottom from '@/utils/hooks/useSystemGestureInsetBottom'
import { filterLocalCandidates, sortImportPlaylists, type ImportCandidate } from '@/utils/playlistImport/local'
import PlaylistImportFlow from './PlaylistImportFlow'

interface PlaylistImportPanelProps {
  visible: boolean
  loading: boolean
  submitting: boolean
  bottomInset: number
  targetListName?: string
  targetListId?: string
  onImported?: (id: string) => void
  items: ImportCandidate[]
  selectedMap: Record<string, true>
  allSelected: boolean
  cancelText: string
  title: string
  selectAllText: string
  clearSelectionText: string
  loadingText: string
  emptyText: string
  countText: string
  confirmText: string
  onClose: () => void
  onSubmit: () => void
  onToggleSelectAll: (visibleIds: string[]) => void
  onToggleItem: (id: string) => void
  getSourceTone?: (source: string) => { text: string, background: string }
}


export default function PlaylistImportPanel(props: PlaylistImportPanelProps) {
  if (!props.visible) return null
  return <ImportPanelContent {...props} />
}

function ImportPanelContent(props: PlaylistImportPanelProps) {
  const t = useI18n()
  const styles = useStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const playlists = useMyList()
  const inset = useSystemGestureInsetBottom()
  const [search, setSearch] = useState('')
  const [newestFirst, setNewestFirst] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const groups = useMemo(() => sortImportPlaylists(playlists.filter(list => list.id !== props.targetListId && list.id !== LIST_IDS.DEFAULT), newestFirst)
    .map(list => ({ list, songs: filterLocalCandidates(props.items, list, search) }))
    .filter(group => !search.trim() || group.list.name.toLowerCase().includes(search.trim().toLowerCase()) || group.songs.length),
  [playlists, props.targetListId, props.items, newestFirst, search])
  const active = groups.find(group => group.list.id === activeId)
  const songs = active?.songs ?? []
  const visibleIds = songs.map(song => song.id)
  const allSelected = visibleIds.length > 0 && visibleIds.every(id => props.selectedMap[id])
  const count = Object.keys(props.selectedMap).length
  return <PlaylistImportFlow targetListId={props.targetListId} targetListName={props.targetListName} onClose={props.onClose} onImported={props.onImported} local={{
    submitting: props.submitting,
    render: header => <FlatList
      data={active ? songs : []}
      keyExtractor={item => item.id}
      extraData={props.selectedMap}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={styles.page}
      ListHeaderComponent={<>
        {header}
        <View style={styles.search}>
          <View style={{ flex: 1 }}><UnderlineInput accessibilityLabel={t('import_lux_search')} placeholder={t('import_lux_search')} value={search} onChangeText={setSearch} editable={!props.submitting} autoCorrect={false} autoCapitalize="none" returnKeyType="search" disableFullscreenUI /></View>
          {search ? <IconButton name="close-circle" size={28} accessibilityLabel={t('search_clear')} disabled={props.submitting} onPress={() => { setSearch('') }} /> : null}
        </View>
        <View style={styles.tools}>
          <SecondaryButton compact label={t(newestFirst ? 'import_lux_newest' : 'import_lux_oldest')} disabled={props.submitting} onPress={() => { setNewestFirst(value => !value) }} />
          {active && visibleIds.length ? <TextButton labelSize={13} label={t(allSelected ? 'import_lux_clear' : 'import_lux_select_all')} disabled={props.submitting} onPress={() => { props.onToggleSelectAll(visibleIds) }} /> : null}
        </View>
        <Text size={12} color={r.muted}>{t('import_lux_sort_hint')}</Text>
        {props.loading ? <Text size={15} color={r.muted} style={styles.message}>{props.loadingText}</Text> : <>
          {active ? <TextButton label={t('import_lux_choose')} disabled={props.submitting} onPress={() => { setActiveId(null) }} /> : groups.map(({ list, songs }) => <MagazineSheetRow key={list.id} coverSize={0} title={list.name} subtitle={t('import_lux_available', { num: songs.length })} current={activeId === list.id} onPress={props.submitting ? undefined : () => { setActiveId(value => value === list.id ? null : list.id) }} trailing={<MdiIcon name={activeId === list.id ? 'chevron-up' : 'chevron-down'} size={22} color={r.ink} />} />)}
          {!groups.length ? <EmptyState title={search.trim() ? t('sheet_import_empty_match') : props.emptyText} /> : null}
          {active ? <Text size={22} color={r.ink} style={styles.message}>{active.list.name}</Text> : null}
          {active && !songs.length ? <EmptyState title={props.emptyText} /> : null}
        </>}
      </>}
      renderItem={({ item }) => <TouchableOpacity activeOpacity={0.7} disabled={props.submitting} accessibilityRole="checkbox" accessibilityLabel={`${item.musicInfo.name} · ${item.musicInfo.singer}`} accessibilityState={{ checked: Boolean(props.selectedMap[item.id]), disabled: props.submitting }} onPress={() => { props.onToggleItem(item.id) }}>
        <MagazineSheetRow reviewLayout title={item.musicInfo.name} coverUri={pickMusicCover(item.musicInfo)} leading={<View style={styles.check}><Checkbox checked={Boolean(props.selectedMap[item.id])} disabled={props.submitting} /></View>} subtitle={<View style={styles.subtitle}><SourceTag source={item.musicInfo.source} label={item.musicInfo.source} /><Text size={12} color={r.muted} numberOfLines={1} style={{ flexShrink: 1 }}>{item.musicInfo.singer}</Text></View>} />
      </TouchableOpacity>}
    />,
    footer: <View style={[styles.footer, { paddingBottom: inset + 26 }]}>
      <Text size={12} color={r.muted}>{t('import_will_add', { num: count })}</Text>
      <PrimaryButton compact label={props.submitting ? t('import_saving') : t('list_import')} badge={count} disabled={props.submitting || props.loading || !count} onPress={props.onSubmit} style={{ flex: 1 }} />
    </View>,
  }} />
}

const useStyles = sharedLuxStyles(colors => {
  const r = magazineRoles(colors)
  return createStyle({
    page: { paddingHorizontal: 22, paddingBottom: 24 },
    search: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
    tools: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 60 },
    message: { marginVertical: 16, fontWeight: '700' },
    check: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    subtitle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    footer: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 12, paddingHorizontal: 22, borderTopWidth: 2, borderTopColor: r.ink, backgroundColor: r.paper },
  })
})
