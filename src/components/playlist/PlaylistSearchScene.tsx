/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { type RefObject } from 'react'
import { FlatList, TextInput, TouchableOpacity, View, type ListRenderItem } from 'react-native'

import MusicAddModal, { type MusicAddModalType } from '@/components/MusicAddModal'
import Text from '@/components/common/Text'
import { MdiIcon } from '@/components/common/MdiIcon'
import {
  Chip,
  EmptyState,
  MagTopBar,
  SectionHeader,
} from '@/components/magazine'
import { type useI18n } from '@/lang'
import { useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { PAGE_GUTTER, magType } from '@/theme/magazineType'

type SearchSourceAction = 'all' | LX.OnlineSource
interface SourceMenuItem {
  action: SearchSourceAction
  label: string
}

export interface PlaylistSearchSceneProps {
  styles: Record<string, any>
  t: ReturnType<typeof useI18n>
  statusBarHeight: number
  bottomDockHeight: number
  isSourceMenuVisible: boolean
  sourceMenuBackdropOpacity?: unknown
  sourceMenuWidth?: unknown
  sourceMenuHeight?: unknown
  sourceMenuRadius?: unknown
  sourceMenuListOpacity?: unknown
  sourceMenuListTranslateY?: unknown
  sourceChevronRotate?: unknown
  sourceMenus: readonly SourceMenuItem[]
  searchSource: SearchSourceAction
  searchSourceLabel: string
  searchInputRef: RefObject<TextInput>
  isSearchInputEditing: boolean
  searchText: string
  searchKeyword: string
  searchLoading: boolean
  searchResults: LX.Music.MusicInfoOnline[]
  searchAssistKeyword: string
  searchAssistList: string[]
  searchHistoryList: string[]
  searchTipLoading: boolean
  musicAddModalRef: RefObject<MusicAddModalType>
  renderSearchResultItem: ListRenderItem<LX.Music.MusicInfoOnline>
  getSourceMenuLabel: (source: SearchSourceAction) => string
  onCloseSourceMenu: () => void
  onExitSearch: () => void
  onBeginSearchInputEdit: () => void
  onSearchInputBlur: () => void
  onSearchTextChange: (text: string) => void
  onSubmitSearch: (text: string) => void
  onToggleSearchSourceMenu: () => void
  onSelectSource: (source: SearchSourceAction) => void
  onClearSearchHistoryList: () => void
  onPickSearchKeyword: (keyword: string) => void
  onRemoveSearchHistoryItem: (keyword: string) => void
}

export default ({
  t,
  statusBarHeight,
  bottomDockHeight,
  searchInputRef,
  isSearchInputEditing,
  searchText,
  searchKeyword,
  searchLoading,
  searchResults,
  searchHistoryList,
  musicAddModalRef,
  renderSearchResultItem,
  onExitSearch,
  onBeginSearchInputEdit,
  onSearchInputBlur,
  onSearchTextChange,
  onSubmitSearch,
  onClearSearchHistoryList,
  onPickSearchKeyword,
  onRemoveSearchHistoryItem,
}: PlaylistSearchSceneProps) => {
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)

  return (
    <>
      <View style={{ flex: 1, backgroundColor: r.paper }}>
        <FlatList
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingTop: statusBarHeight,
            paddingHorizontal: PAGE_GUTTER,
            paddingBottom: 16 + bottomDockHeight,
          }}
          data={searchResults}
          renderItem={renderSearchResultItem}
          keyExtractor={(item, index) => `${item.id}_${item.source}_${index}`}
          ListHeaderComponent={(
            <View>
              <MagTopBar onBack={onExitSearch} />
              <Text
                size={magType.eyebrow.size}
                color={r.eyebrow}
                style={{ fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', marginTop: 18 }}
              >
                {t('library_search_eyebrow')}
              </Text>

              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: 14,
                borderBottomWidth: 1.5,
                borderBottomColor: r.ink,
                paddingBottom: 8,
                gap: 10,
              }}>
                <MdiIcon name="magnify" size={24} color={r.ink} />
                {isSearchInputEditing
                  ? (
                    <TextInput
                      ref={searchInputRef}
                      style={{
                        flex: 1,
                        fontSize: magType.searchInput.size,
                        fontWeight: '800',
                        color: r.ink,
                        paddingVertical: 0,
                        includeFontPadding: false,
                      }}
                      value={searchText}
                      onChangeText={onSearchTextChange}
                      disableFullscreenUI
                      blurOnSubmit
                      autoFocus
                      onBlur={onSearchInputBlur}
                      onSubmitEditing={({ nativeEvent }) => { onSubmitSearch(nativeEvent.text ?? searchText) }}
                      returnKeyType="search"
                      placeholder={t('library_search_placeholder')}
                      placeholderTextColor={r.quiet}
                      selectionColor={r.ink}
                      cursorColor={r.ink}
                    />
                    )
                  : (
                    <TouchableOpacity style={{ flex: 1 }} activeOpacity={0.85} onPress={onBeginSearchInputEdit}>
                      <Text
                        size={magType.searchInput.size}
                        color={searchText ? r.ink : r.quiet}
                        numberOfLines={1}
                        style={{ fontWeight: '800' }}
                      >
                        {searchText || t('library_search_placeholder')}
                      </Text>
                    </TouchableOpacity>
                    )}
                {searchText
                  ? (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => { onSearchTextChange('') }}
                      hitSlop={8}
                    >
                      <MdiIcon name="close-circle" size={20} color={r.quiet} />
                    </TouchableOpacity>
                    )
                  : null}
              </View>

              {!searchKeyword
                ? (
                  <View style={{ marginTop: 22 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <Text size={magType.meta.size} color={r.eyebrow} style={{ fontWeight: '600' }}>
                        {t('search_history_search')}
                      </Text>
                      {searchHistoryList.length
                        ? (
                          <TouchableOpacity activeOpacity={0.7} onPress={onClearSearchHistoryList} hitSlop={8}>
                            <MdiIcon name="eraser" size={16} color={r.faint} />
                          </TouchableOpacity>
                          )
                        : null}
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {searchHistoryList.length
                        ? searchHistoryList.map((keyword, index) => (
                          <TouchableOpacity
                            key={`${keyword}_${index}`}
                            activeOpacity={0.82}
                            onPress={() => { onPickSearchKeyword(keyword) }}
                            onLongPress={() => { onRemoveSearchHistoryItem(keyword) }}
                          >
                            <Chip label={keyword} />
                          </TouchableOpacity>
                        ))
                        : <Text size={13} color={r.faint}>{t('me_search_hint')}</Text>}
                    </View>
                  </View>
                  )
                : (
                  <SectionHeader
                    title={t('library_search_match')}
                    meta={t('me_tracks_count', { num: searchResults.length })}
                    compactRule
                    style={{ marginTop: 22 }}
                  />
                  )}
            </View>
          )}
          ListEmptyComponent={(
            searchKeyword
              ? (
                <EmptyState
                  eyebrow={searchLoading ? 'LOADING' : 'NO RESULT · 0'}
                  title={searchLoading ? t('me_searching') : t('me_search_no_match')}
                />
                )
              : null
          )}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={false}
          initialNumToRender={12}
          windowSize={8}
          maxToRenderPerBatch={12}
          bounces={false}
          alwaysBounceVertical={false}
          overScrollMode="never"
        />
      </View>
      <MusicAddModal ref={musicAddModalRef} />
    </>
  )
}
