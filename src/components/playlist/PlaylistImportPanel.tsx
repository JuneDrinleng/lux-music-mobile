import { FlatList, Modal, TouchableOpacity, View } from 'react-native'
import { Icon } from '@/components/common/Icon'
import Image from '@/components/common/Image'
import Text from '@/components/common/Text'
import { pickMusicCover } from '@/utils/musicCover'
import { createStyle } from '@/utils/tools'

interface ImportCandidate {
  id: string
  musicInfo: LX.Music.MusicInfo
  fromListName: string
}

interface SourceTone {
  text: string
  background: string
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
  getSourceTone: (source: string) => SourceTone
}

export default ({
  visible,
  loading,
  submitting,
  bottomInset,
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
  countText,
  confirmText,
  onClose,
  onSubmit,
  onToggleSelectAll,
  onToggleItem,
  getSourceTone,
}: PlaylistImportPanelProps) => {
  return (
    <Modal
      transparent={true}
      animationType="slide"
      statusBarTranslucent={true}
      presentationStyle="overFullScreen"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.mask}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={[styles.panel, { paddingBottom: 14 + bottomInset }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <TouchableOpacity activeOpacity={0.8} onPress={onClose}>
              <Text size={13} color="#6b7280">{cancelText}</Text>
            </TouchableOpacity>
            <View style={styles.headerTitleWrap}>
              <Text size={16} color="#111827" style={styles.headerTitle} numberOfLines={1}>{title}</Text>
              {targetListName
                ? <Text size={11} color="#7d8190" numberOfLines={1}>{targetListName}</Text>
                : null}
            </View>
            <View style={styles.headerRightSpacer} />
          </View>

          <View style={styles.toolbar}>
            <Text size={12} color="#6b7280" numberOfLines={1}>{loading ? loadingText : countText}</Text>
            {items.length
              ? (
                  <TouchableOpacity
                    activeOpacity={0.82}
                    disabled={submitting}
                    onPress={onToggleSelectAll}
                    style={styles.toolbarButton}
                  >
                    <Text size={12} color={submitting ? '#9ca3af' : '#111827'} style={styles.toolbarButtonText}>
                      {allSelected ? clearSelectionText : selectAllText}
                    </Text>
                  </TouchableOpacity>
                )
              : null}
          </View>

          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const sourceTone = getSourceTone(item.musicInfo.source)
              const isSelected = Boolean(selectedMap[item.id])
              return (
                <TouchableOpacity
                  style={[
                    styles.item,
                    isSelected ? styles.itemSelected : null,
                  ]}
                  activeOpacity={0.85}
                  onPress={() => { onToggleItem(item.id) }}
                >
                  <View style={styles.itemCheckWrap}>
                    <Icon
                      name={isSelected ? 'checkbox-marked' : 'checkbox-blank-outline'}
                      rawSize={22}
                      color={isSelected ? '#111827' : '#9ca3af'}
                    />
                  </View>
                  <Image style={styles.itemCover} url={pickMusicCover(item.musicInfo)} />
                  <View style={styles.itemMain}>
                    <Text size={14} color="#111827" style={styles.itemName} numberOfLines={1}>{item.musicInfo.name}</Text>
                    <View style={styles.itemMetaRow}>
                      <Text size={10} color={sourceTone.text} style={[styles.sourceBadge, { backgroundColor: sourceTone.background }]}>
                        {item.musicInfo.source.toUpperCase()}
                      </Text>
                      <Text size={11} color="#6b7280" numberOfLines={1}>{item.musicInfo.singer}</Text>
                    </View>
                    <Text size={11} color="#9ca3af" numberOfLines={1}>{item.fromListName}</Text>
                  </View>
                </TouchableOpacity>
              )
            }}
            ListEmptyComponent={(
              <View style={styles.emptyCard}>
                <Text size={13} color="#6b7280">{loading ? loadingText : emptyText}</Text>
              </View>
            )}
          />

          <View style={styles.footer}>
            <Text size={12} color="#6b7280" numberOfLines={1}>{loading ? loadingText : countText}</Text>
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={submitting || !items.length || !Object.keys(selectedMap).length}
              onPress={onSubmit}
              style={[
                styles.confirmButton,
                submitting || !items.length || !Object.keys(selectedMap).length ? styles.confirmButtonDisabled : null,
              ]}
            >
              <Text
                size={13}
                color={submitting || !items.length || !Object.keys(selectedMap).length ? '#9ca3af' : '#17191f'}
                style={styles.confirmButtonText}
              >
                {confirmText}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = createStyle({
  mask: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.32)',
  },
  panel: {
    maxHeight: '78%',
    minHeight: 320,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: '#edf0f7',
    backgroundColor: '#ffffff',
    shadowColor: '#111827',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -5 },
    elevation: 6,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#d5d8e0',
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 12,
  },
  headerTitle: {
    fontWeight: '700',
  },
  headerRightSpacer: {
    minWidth: 28,
  },
  toolbar: {
    minHeight: 34,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#edf0f7',
    backgroundColor: '#f8f9fc',
    paddingHorizontal: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toolbarButton: {
    paddingVertical: 6,
    paddingLeft: 12,
  },
  toolbarButtonText: {
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 16,
  },
  item: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#edf0f7',
    backgroundColor: '#ffffff',
    shadowColor: '#76809b',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  itemSelected: {
    borderColor: '#d7e08b',
    backgroundColor: '#f6f9ea',
  },
  itemCheckWrap: {
    width: 28,
    alignItems: 'flex-start',
  },
  itemCover: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
  },
  itemMain: {
    flex: 1,
    marginLeft: 10,
  },
  itemName: {
    fontWeight: '700',
    marginBottom: 4,
  },
  itemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  sourceBadge: {
    borderRadius: 10,
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontWeight: '600',
    marginRight: 6,
  },
  emptyCard: {
    minHeight: 140,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#edf0f7',
    backgroundColor: '#f8f9fc',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#edf0f7',
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  confirmButton: {
    minWidth: 108,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#d9ef62',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  confirmButtonDisabled: {
    backgroundColor: '#eef1f6',
  },
  confirmButtonText: {
    fontWeight: '700',
  },
})
