import MaterialCommunityIcon from 'react-native-vector-icons/MaterialCommunityIcons'
import { TouchableOpacity, View } from 'react-native'
import Image from '@/components/common/Image'
import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import styles from './styles'
import { type PlaylistDetailPrimaryAction, type SourceTagTone } from './types'

export interface PlaylistDetailHeaderProps {
  topPadding: number
  coverUrl?: string | null
  name: string
  metaText: string
  sourceCode?: string | null
  sourceTone?: SourceTagTone | null
  sourceLabel?: string
  canRename: boolean
  primaryAction?: PlaylistDetailPrimaryAction
  onBack: () => void
  onRename?: () => void
  onRemove?: () => void
}

export default ({
  topPadding,
  coverUrl,
  name,
  metaText,
  sourceCode,
  sourceTone,
  sourceLabel,
  canRename,
  primaryAction,
  onBack,
  onRename,
  onRemove,
}: PlaylistDetailHeaderProps) => {
  const t = useI18n()

  return (
    <>
      <View style={[styles.header, { paddingTop: topPadding }]}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.detailBackBtn} activeOpacity={0.82} onPress={onBack}>
            <View style={styles.detailBackBtnInner}>
              <Icon name="chevron-left" rawSize={20} color="#232733" />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.detailHeroCard}>
        <View style={styles.detailHero}>
          <Image style={styles.detailHeroCover} url={coverUrl ?? null} />
          <View style={styles.detailHeroText}>
            <View style={styles.detailHeroNameRow}>
              <Text size={22} color="#111827" style={styles.detailHeroName} numberOfLines={1}>{name}</Text>
              {canRename
                ? <View style={styles.detailHeroActions}>
                    <TouchableOpacity style={styles.detailHeroIconBtn} activeOpacity={0.8} onPress={onRename}>
                      <MaterialCommunityIcon name="pencil-outline" size={16} color="#111827" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.detailHeroIconBtn, styles.detailHeroDeleteBtn]} activeOpacity={0.8} onPress={onRemove}>
                      <MaterialCommunityIcon name="trash-can-outline" size={16} color="#dc2626" />
                    </TouchableOpacity>
                  </View>
                : null}
            </View>
            <Text size={12} color="#6b7280" style={styles.detailHeroMeta}>{metaText}</Text>
            {sourceCode && sourceTone && sourceLabel
              ? <View style={styles.detailHeroSourceRow}>
                  <Text
                    size={10}
                    color={sourceTone.text}
                    style={[styles.songSource, styles.detailHeroSourceBadge, { backgroundColor: sourceTone.background }]}
                  >
                    {sourceCode.toUpperCase()}
                  </Text>
                  <Text size={11} color="#7b8494" numberOfLines={1} style={styles.detailHeroSourceText}>{sourceLabel}</Text>
                </View>
              : null}
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text size={18} color="#111827" style={styles.sectionTitle}>{t('me_songs')}</Text>
          {primaryAction
            ? <TouchableOpacity
                activeOpacity={0.8}
                onPress={primaryAction.onPress}
                disabled={primaryAction.disabled}
                style={[styles.detailActionBtn, primaryAction.disabled ? styles.detailActionBtnDisabled : null]}
              >
                <Text size={13} color={primaryAction.disabled ? '#9ca3af' : '#111827'} style={styles.detailActionBtnText}>
                  {primaryAction.label}
                </Text>
              </TouchableOpacity>
            : null}
        </View>
      </View>
    </>
  )
}
