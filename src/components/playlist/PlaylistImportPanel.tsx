/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { FlatList, View } from 'react-native'

import Text from '@/components/common/Text'
import {
  Checkbox,
  MagazineSheet,
  MagazineSheetRow,
  SourceTag,
} from '@/components/magazine'
import { useI18n } from '@/lang'
import { useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { pickMusicCover } from '@/utils/musicCover'

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
  onToggleSelectAll: () => void
  onToggleItem: (id: string) => void
  getSourceTone?: (source: string) => { text: string, background: string }
}

export default ({
  visible,
  loading,
  submitting,
  bottomInset: _bottomInset,
  targetListName,
  items,
  selectedMap,
  allSelected,
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
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const selectedCount = Object.keys(selectedMap).length
  const meta = loading
    ? loadingText
    : t('sheet_import_meta', { num: items.length })
  const figure = !loading && items.length
    ? { value: String(items.length), unit: t('sheet_import_figure_unit') }
    : undefined

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
      headerAction={items.length
        ? {
            text: allSelected ? clearSelectionText : selectAllText,
            tone: 'ink',
            disabled: submitting,
            onPress: onToggleSelectAll,
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
      {items.length
        ? (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
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
                  last={index >= items.length - 1}
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
