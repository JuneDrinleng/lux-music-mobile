import { type RefObject } from 'react'
import { Animated, FlatList, ScrollView, TextInput, TouchableOpacity, View, type ListRenderItem } from 'react-native'
import MaterialCommunityIcon from 'react-native-vector-icons/MaterialCommunityIcons'

import MusicAddModal, { type MusicAddModalType } from '@/components/MusicAddModal'
import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import GlassSearchField from '@/components/search/GlassSearchField'
import { getSourceTone } from '@/components/search/sourceTone'
import { type useI18n } from '@/lang'

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
  sourceMenuBackdropOpacity: Animated.AnimatedInterpolation<number>
  sourceMenuWidth: Animated.AnimatedInterpolation<number>
  sourceMenuHeight: Animated.AnimatedInterpolation<number>
  sourceMenuRadius: Animated.AnimatedInterpolation<number>
  sourceMenuListOpacity: Animated.AnimatedInterpolation<number>
  sourceMenuListTranslateY: Animated.AnimatedInterpolation<number>
  sourceChevronRotate: Animated.AnimatedInterpolation<string>
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
  styles,
  t,
  statusBarHeight,
  bottomDockHeight,
  isSourceMenuVisible,
  sourceMenuBackdropOpacity,
  sourceMenuWidth,
  sourceMenuHeight,
  sourceMenuRadius,
  sourceMenuListOpacity,
  sourceMenuListTranslateY,
  sourceChevronRotate,
  sourceMenus,
  searchSource,
  searchSourceLabel,
  searchInputRef,
  isSearchInputEditing,
  searchText,
  searchKeyword,
  searchLoading,
  searchResults,
  searchAssistKeyword,
  searchAssistList,
  searchHistoryList,
  searchTipLoading,
  musicAddModalRef,
  renderSearchResultItem,
  getSourceMenuLabel,
  onCloseSourceMenu,
  onExitSearch,
  onBeginSearchInputEdit,
  onSearchInputBlur,
  onSearchTextChange,
  onSubmitSearch,
  onToggleSearchSourceMenu,
  onSelectSource,
  onClearSearchHistoryList,
  onPickSearchKeyword,
  onRemoveSearchHistoryItem,
}: PlaylistSearchSceneProps) => {
  const searchHeaderHeight = statusBarHeight + 18 + 44 + 16

  return (
    <>
      <View style={styles.searchModeRoot}>
        {isSourceMenuVisible
          ? <Animated.View style={[styles.sourceMenuPageBackdropWrap, styles.sourceMenuBackdrop, { opacity: sourceMenuBackdropOpacity }]}>
              <TouchableOpacity style={styles.sourceMenuPageBackdrop} activeOpacity={1} onPress={onCloseSourceMenu} />
            </Animated.View>
          : null}
        <View style={styles.searchResultHeaderFloating}>
          <View style={[styles.searchResultHeader, { paddingTop: statusBarHeight + 18 }]}>
            <View style={styles.topBar}>
              <TouchableOpacity style={styles.detailBackBtn} activeOpacity={0.8} onPress={onExitSearch}>
                <View style={styles.detailBackBtnInner}>
                  <Icon name="chevron-left" rawSize={20} color="#232733" />
                </View>
              </TouchableOpacity>
              <View style={styles.searchResultSearchWrap}>
                <GlassSearchField style={styles.searchWrap} contentStyle={styles.searchContent}>
                  <Icon name="search-2" rawSize={18} color="#666d7b" />
                  {isSearchInputEditing
                    ? <TextInput
                        ref={searchInputRef}
                        style={styles.searchInput}
                        value={searchText}
                        onChangeText={onSearchTextChange}
                        disableFullscreenUI
                        blurOnSubmit
                        autoFocus
                        onBlur={onSearchInputBlur}
                        onSubmitEditing={({ nativeEvent }) => { onSubmitSearch(nativeEvent.text ?? searchText) }}
                        returnKeyType="search"
                        placeholder={t('me_search_placeholder')}
                        placeholderTextColor="#9aa1ae"
                      />
                    : <TouchableOpacity style={styles.searchInputDisplay} activeOpacity={0.85} onPress={onBeginSearchInputEdit}>
                        <Text size={13} color={searchText ? '#232733' : '#9aa1ae'} numberOfLines={1} style={styles.searchInputText}>
                          {searchText || t('me_search_placeholder')}
                        </Text>
                      </TouchableOpacity>}
                  <View style={styles.sourceMenuAnchor}>
                    <Animated.View
                      style={[
                        styles.sourceMenuSheet,
                        {
                          width: sourceMenuWidth,
                          height: sourceMenuHeight,
                          borderRadius: sourceMenuRadius,
                        },
                      ]}
                    >
                      <TouchableOpacity activeOpacity={0.85} onPress={onToggleSearchSourceMenu} style={styles.sourceMenuHeadBtn}>
                        <View style={styles.sourceMenuSheetHead}>
                          <Text size={12} color="#666d7b" style={styles.sourceText}>{searchSourceLabel}</Text>
                          <Animated.View style={[styles.sourceChevronWrap, { transform: [{ rotate: sourceChevronRotate }] }]}>
                            <Icon name="chevron-right-2" rawSize={13} color="#666d7b" />
                          </Animated.View>
                        </View>
                      </TouchableOpacity>
                      <Animated.View
                        pointerEvents={isSourceMenuVisible ? 'auto' : 'none'}
                        style={[
                          styles.sourceMenuSheetList,
                          {
                            opacity: sourceMenuListOpacity,
                            transform: [{ translateY: sourceMenuListTranslateY }],
                          },
                        ]}
                      >
                        {sourceMenus.map((menu, index) => {
                          const isActive = menu.action === searchSource
                          const tone = menu.action === 'all'
                            ? { text: '#6b7280', background: '#f3f4f6' }
                            : getSourceTone(menu.action)
                          return (
                            <TouchableOpacity
                              key={menu.action}
                              activeOpacity={0.78}
                              style={[
                                styles.sourcePanelItem,
                                isActive ? styles.sourcePanelItemActive : null,
                                index < sourceMenus.length - 1 ? styles.sourcePanelItemBorder : null,
                              ]}
                              onPress={() => { onSelectSource(menu.action) }}
                            >
                              <View style={[styles.sourcePanelBadge, { backgroundColor: tone.background }]}>
                                <Text size={10} color={tone.text} style={styles.sourcePanelBadgeText}>
                                  {menu.action == 'all' ? 'ALL' : menu.action.toUpperCase()}
                                </Text>
                              </View>
                              <Text size={13} color="#111827" style={styles.sourcePanelLabel}>
                                {getSourceMenuLabel(menu.action)}
                              </Text>
                              <View style={styles.sourcePanelCheck}>
                                {isActive ? <MaterialCommunityIcon name="check" size={16} color="#111827" /> : null}
                              </View>
                            </TouchableOpacity>
                          )
                        })}
                      </Animated.View>
                    </Animated.View>
                  </View>
                </GlassSearchField>
              </View>
            </View>
          </View>
        </View>
        {isSearchInputEditing
          ? <View style={[styles.searchAssistPanel, { top: searchHeaderHeight }]}>
              {!searchAssistKeyword
                ? <View style={styles.searchAssistTitleRow}>
                    <Text size={13} color="#6b7280">{t('search_history_search')}</Text>
                    {searchHistoryList.length
                      ? (
                          <TouchableOpacity
                            style={styles.searchAssistClearBtn}
                            activeOpacity={0.8}
                            onPress={onClearSearchHistoryList}
                          >
                            <Icon name="eraser" rawSize={14} color="#9ca3af" />
                          </TouchableOpacity>
                        )
                      : null}
                  </View>
                : null}
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="always"
                contentContainerStyle={styles.searchAssistContent}
              >
                {searchAssistList.length
                  ? searchAssistList.map((keyword, index) => {
                    return (
                      <TouchableOpacity
                        key={`${keyword}_${index}`}
                        style={styles.searchAssistChip}
                        activeOpacity={0.82}
                        onPress={() => { onPickSearchKeyword(keyword) }}
                        onLongPress={!searchAssistKeyword ? () => { onRemoveSearchHistoryItem(keyword) } : undefined}
                      >
                        <Text size={13} color="#111827" numberOfLines={1} style={styles.searchAssistChipText}>{keyword}</Text>
                      </TouchableOpacity>
                    )
                  })
                  : (
                      <View style={styles.searchAssistEmpty}>
                        <Text size={13} color="#9ca3af">
                          {searchAssistKeyword
                            ? searchTipLoading
                              ? t('me_searching')
                              : t('me_search_no_match')
                            : t('me_search_hint')}
                        </Text>
                      </View>
                    )}
              </ScrollView>
            </View>
          : null}
        <FlatList
          style={styles.searchResultList}
          contentContainerStyle={[
            styles.detailContent,
            styles.searchResultContent,
            { paddingTop: searchHeaderHeight, paddingBottom: 16 + bottomDockHeight },
          ]}
          data={searchResults}
          renderItem={renderSearchResultItem}
          keyExtractor={(item, index) => `${item.id}_${item.source}_${index}`}
          ListEmptyComponent={(
            <View style={styles.searchResultStatus}>
              <Text size={16} color="#6b7280" style={styles.searchResultStatusText}>
                {searchLoading
                  ? t('me_searching')
                  : searchKeyword
                    ? t('me_search_no_match')
                    : t('me_search_hint')}
              </Text>
            </View>
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
