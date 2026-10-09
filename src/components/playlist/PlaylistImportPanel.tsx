/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { useEffect, useMemo, useState } from 'react'
import { FlatList, TextInput, TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import { MdiIcon } from '@/components/common/MdiIcon'
import {
  Checkbox,
  EmptyState,
  MagazineSheet,
  MagazineSheetRow,
  SourceTag,
} from '@/components/magazine'
import { useI18n } from '@/lang'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { magType } from '@/theme/magazineType'
import { pickMusicCover } from '@/utils/musicCover'
import { createStyle } from '@/utils/tools'

interface ImportCandidate {
  id: string
  musicInfo: LX.Music.MusicInfo
  fromListName: string
}

interface PlaylistImportPanelProps {
  visible: boolean
  loading: boolean
  submitting: boolean
  bottomInset: number
  targetListName?: string
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

const matchesImportQuery = (item: ImportCandidate, query: string) => {
  if (!query) return true
  const name = item.musicInfo.name?.toLowerCase() ?? ''
  const singer = item.musicInfo.singer?.toLowerCase() ?? ''
  const from = item.fromListName?.toLowerCase() ?? ''
  return name.includes(query) || singer.includes(query) || from.includes(query)
}

export default ({
  visible,
  loading,
  submitting,
  bottomInset: _bottomInset,
  targetListName,
  items,
  selectedMap,
  allSelected: _allSelected,
  cancelText,
  title,
  selectAllText,
  clearSelectionText,
  loadingText,
  emptyText,
  countText: _countText,
  confirmText,
  onClose,
  onSubmit,
  onToggleSelectAll,
  onToggleItem,
}: PlaylistImportPanelProps) => {
  const t = useI18n()
  const styles = useLuxStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const [searchText, setSearchText] = useState('')
  const selectedCount = Object.keys(selectedMap).length
  const query = searchText.trim().toLowerCase()
  const filteredItems = useMemo(
    () => (query ? items.filter(item => matchesImportQuery(item, query)) : items),
    [items, query],
  )
  const visibleIds = useMemo(() => filteredItems.map(item => item.id), [filteredItems])
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedMap[id])
  const isFiltering = query.length > 0

  useEffect(() => {
    if (!visible) setSearchText('')
  }, [visible])

  const meta = loading
    ? loadingText
    : isFiltering
      ? t('sheet_import_meta_filtered', { found: filteredItems.length, total: items.length })
      : t('sheet_import_meta', { num: items.length })
  const figure = !loading && items.length
    ? { value: String(items.length), unit: t('sheet_import_figure_unit') }
    : undefined

  const searchField = items.length
    ? (
      <View style={styles.searchUnderline}>
        <MdiIcon name="magnify" size={22} color={r.ink} />
        <TextInput
          style={styles.searchInput}
          value={searchText}
          onChangeText={setSearchText}
          disableFullscreenUI
          blurOnSubmit
          underlineColorAndroid="transparent"
          selectionColor={r.ink}
          cursorColor={r.ink}
          returnKeyType="search"
          placeholder={t('sheet_import_search_placeholder')}
          placeholderTextColor={r.quiet}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {searchText.length
          ? (
            <TouchableOpacity
              style={styles.clearSearchButton}
              activeOpacity={0.7}
              onPress={() => { setSearchText('') }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('search_clear')}
            >
              <MdiIcon name="close-circle" size={20} color={r.quiet} />
            </TouchableOpacity>
            )
          : null}
      </View>
      )
    : undefined

  const showMatchEmpty = !loading && items.length > 0 && isFiltering && filteredItems.length === 0

  return (
    <MagazineSheet
      visible={visible}
      onClose={onClose}
      heightRatio={0.78}
      eyebrow={targetListName
        ? t('sheet_import_eyebrow', { name: targetListName })
        : t('list_import')}
      title={title}
      meta={meta}
      figure={figure}
      toolExtra={searchField}
      headerAction={filteredItems.length
        ? {
            text: allVisibleSelected ? clearSelectionText : selectAllText,
            tone: 'ink',
            disabled: submitting,
            onPress: () => { onToggleSelectAll(visibleIds) },
          }
        : undefined}
      loading={loading}
      empty={{ text: emptyText, eyebrow: 'EMPTY' }}
      footer={{
        cancel: cancelText,
        primary: confirmText,
        count: selectedCount > 0 ? selectedCount : undefined,
        disabled: submitting || !items.length || selectedCount === 0,
        onCancel: onClose,
        onPrimary: onSubmit,
      }}
    >
      {showMatchEmpty
        ? <EmptyState eyebrow="EMPTY" title={t('sheet_import_empty_match')} />
        : filteredItems.length
          ? (
            <FlatList
              data={filteredItems}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 8 }}
              renderItem={({ item, index }) => {
                const isSelected = Boolean(selectedMap[item.id])
                const sourceLabel = item.musicInfo.source !== 'local'
                  ? item.musicInfo.source.toUpperCase()
                  : ''
                return (
                  <MagazineSheetRow
                    coverUri={pickMusicCover(item.musicInfo)}
                    coverSize={40}
                    title={item.musicInfo.name}
                    last={index >= filteredItems.length - 1}
                    onPress={() => { onToggleItem(item.id) }}
                    leading={
                      <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                        <Checkbox
                          checked={isSelected}
                          onChange={() => { onToggleItem(item.id) }}
                          disabled={submitting}
                        />
                      </View>
                    }
                    subtitle={
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {sourceLabel
                          ? <SourceTag source={item.musicInfo.source} label={sourceLabel} />
                          : null}
                        <Text size={12} color={r.muted} numberOfLines={1}>
                          {[item.musicInfo.singer, t('sheet_import_from', { name: item.fromListName })].filter(Boolean).join(' · ')}
                        </Text>
                      </View>
                    }
                  />
                )
              }}
            />
            )
          : null}
    </MagazineSheet>
  )
}

const useLuxStyles = sharedLuxStyles((colors) => {
  const r = magazineRoles(colors)
  return createStyle({
    searchUnderline: {
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 1.5,
      borderBottomColor: r.ink,
      paddingBottom: 8,
      gap: 10,
    },
    searchInput: {
      flex: 1,
      fontSize: magType.searchInput.size,
      fontWeight: '800',
      color: r.ink,
      paddingVertical: 0,
      includeFontPadding: false,
      margin: 0,
      backgroundColor: 'transparent',
    },
    clearSearchButton: {
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
  })
})
