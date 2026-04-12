import { useMemo } from 'react'
import { FlatList, TouchableOpacity, View } from 'react-native'
import BottomSheetModal from '@/components/common/BottomSheetModal'
import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { getSourceTagColor } from './constants'
import styles from './styles'
import { type PlaylistImportCandidate } from './types'

export interface PlaylistImportDrawerProps {
  visible: boolean
  bottomInset: number
  candidates: PlaylistImportCandidate[]
  selectedMap: Record<string, true>
  loading: boolean
  submitting: boolean
  onClose: () => void
  onToggleSong: (songId: string) => void
  onConfirm: () => void
}

export default ({
  visible,
  bottomInset,
  candidates,
  selectedMap,
  loading,
  submitting,
  onClose,
  onToggleSong,
  onConfirm,
}: PlaylistImportDrawerProps) => {
  const t = useI18n()
  const selectedCount = useMemo(() => Object.keys(selectedMap).length, [selectedMap])

  return (
    <BottomSheetModal
      visible={visible}
      title={t('list_import')}
      bottomInset={bottomInset}
      onClose={onClose}
      onConfirm={onConfirm}
      closeDisabled={submitting}
      confirmDisabled={selectedCount < 1 || submitting}
      confirmText={`${t('list_add_title_first_add')}${selectedCount > 0 ? `(${selectedCount})` : ''}`}
    >
      <FlatList
        style={styles.importDrawerList}
        data={candidates}
        renderItem={({ item }) => {
          const isSelected = Boolean(selectedMap[item.id])
          const sourceTone = getSourceTagColor(item.musicInfo.source)
          return (
            <TouchableOpacity
              style={[styles.importSongItem, isSelected ? styles.importSongItemSelected : null]}
              activeOpacity={0.84}
              onPress={() => { onToggleSong(item.id) }}
            >
              <Icon name={isSelected ? 'checkbox-marked' : 'checkbox-blank-outline'} rawSize={22} color={isSelected ? '#111827' : '#9ca3af'} />
              <View style={styles.importSongMain}>
                <Text size={14} color="#111827" style={styles.listTitle} numberOfLines={1}>{item.musicInfo.name}</Text>
                <View style={styles.songMetaRow}>
                  <Text size={10} color={sourceTone.text} style={[styles.songSource, { backgroundColor: sourceTone.background }]}>{item.musicInfo.source.toUpperCase()}</Text>
                  <Text size={11} color="#6b7280" numberOfLines={1}>{item.musicInfo.singer}</Text>
                </View>
                <Text size={10} color="#9ca3af" numberOfLines={1}>{item.fromListName}</Text>
              </View>
            </TouchableOpacity>
          )
        }}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.importDrawerContent}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={(
          <View style={styles.emptyCard}>
            <Text size={13} color="#6b7280">{loading ? t('list_loading') : t('me_no_songs')}</Text>
          </View>
        )}
      />
    </BottomSheetModal>
  )
}
