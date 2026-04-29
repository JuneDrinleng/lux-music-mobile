import { TouchableOpacity, View } from 'react-native'
import MaterialCommunityIcon from 'react-native-vector-icons/MaterialCommunityIcons'

import Image from '@/components/common/Image'
import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import { createStyle } from '@/utils/tools'

interface SourceTone {
  text: string
  background: string
}

interface PlaylistDetailHeaderProps {
  statusBarHeight: number
  cover: string | null
  name: string
  metaText: string
  sectionTitle: string
  sourceCode?: string | null
  sourceLabel?: string
  sourceTone?: SourceTone | null
  canRename: boolean
  actionLabel?: string | null
  actionDisabled?: boolean
  onBack: () => void
  onRename?: () => void
  onRemove?: () => void
  onActionPress?: () => void
}

export default ({
  statusBarHeight,
  cover,
  name,
  metaText,
  sectionTitle,
  sourceCode,
  sourceLabel,
  sourceTone,
  canRename,
  actionLabel,
  actionDisabled = false,
  onBack,
  onRename,
  onRemove,
  onActionPress,
}: PlaylistDetailHeaderProps) => {
  return (
    <>
      <View style={[styles.header, { paddingTop: statusBarHeight + 18 }]}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backButton} activeOpacity={0.82} onPress={onBack}>
            <View style={styles.backButtonInner}>
              <Icon name="chevron-left" rawSize={20} color="#232733" />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.heroCard}>
        <Image style={styles.cover} url={cover} />
        <View style={styles.heroContent}>
          <Text size={22} color="#111827" style={styles.name} numberOfLines={2}>{name}</Text>
          <Text size={12} color="#6b7280" style={styles.meta} numberOfLines={2}>{metaText}</Text>
          {sourceCode && sourceTone
            ? (
                <View style={styles.sourceRow}>
                  <Text
                    size={10}
                    color={sourceTone.text}
                    style={[styles.sourceBadge, { backgroundColor: sourceTone.background }]}
                  >
                    {sourceCode.toUpperCase()}
                  </Text>
                  {sourceLabel
                    ? <Text size={11} color="#7b8494" numberOfLines={1} style={styles.sourceLabel}>{sourceLabel}</Text>
                    : null}
                </View>
              )
            : null}
          {canRename
            ? (
                <View style={styles.managementRow}>
                  <TouchableOpacity style={styles.iconButton} activeOpacity={0.8} onPress={onRename}>
                    <MaterialCommunityIcon name="pencil-outline" size={16} color="#111827" />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.iconButton, styles.removeButton]} activeOpacity={0.8} onPress={onRemove}>
                    <MaterialCommunityIcon name="trash-can-outline" size={16} color="#dc2626" />
                  </TouchableOpacity>
                </View>
              )
            : null}
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text size={18} color="#111827" style={styles.sectionTitle}>{sectionTitle}</Text>
        {actionLabel
          ? (
              <TouchableOpacity
                activeOpacity={0.8}
                disabled={actionDisabled}
                onPress={onActionPress}
                style={[
                  styles.actionButton,
                  actionDisabled ? styles.actionButtonDisabled : null,
                ]}
              >
                <Text
                  size={13}
                  color={actionDisabled ? '#9ca3af' : '#111827'}
                  style={styles.actionButtonText}
                >
                  {actionLabel}
                </Text>
              </TouchableOpacity>
            )
          : null}
      </View>
    </>
  )
}

const styles = createStyle({
  header: {
    position: 'relative',
    overflow: 'visible',
    paddingHorizontal: 18,
    paddingBottom: 16,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    padding: 2,
    shadowColor: '#2d3242',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  backButtonInner: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#f3eef2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#edf0f7',
    backgroundColor: '#ffffff',
    shadowColor: '#76809b',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
    marginBottom: 18,
    padding: 16,
    flexDirection: 'row',
  },
  cover: {
    width: 92,
    height: 92,
    borderRadius: 14,
    backgroundColor: '#f3f4f6',
  },
  heroContent: {
    flex: 1,
    marginLeft: 14,
  },
  name: {
    fontWeight: '700',
  },
  meta: {
    marginTop: 4,
    lineHeight: 18,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  sourceBadge: {
    borderRadius: 10,
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontWeight: '600',
    marginRight: 8,
  },
  sourceLabel: {
    flexShrink: 1,
  },
  managementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#f6f7fb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButton: {
    marginLeft: 8,
    backgroundColor: '#fef2f2',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: {
    fontWeight: '700',
  },
  actionButton: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d9e28f',
    backgroundColor: '#f4f8de',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonDisabled: {
    backgroundColor: '#f8fafc',
    borderColor: '#edf2f7',
  },
  actionButtonText: {
    fontWeight: '600',
  },
})
