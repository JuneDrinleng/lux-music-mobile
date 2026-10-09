/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { View } from 'react-native'

import Image from '@/components/common/Image'
import { MdiIcon } from '@/components/common/MdiIcon'
import Text from '@/components/common/Text'
import {
  IconButton,
  MagTopBar,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
  TextButton,
  TextTabs,
} from '@/components/magazine'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { magType } from '@/theme/magazineType'

interface PlaylistDetailHeaderProps {
  statusBarHeight: number
  cover: string | null
  name: string
  metaText: string
  eyebrow: string
  sectionTitle: string
  sectionMeta?: string
  canRename: boolean
  canSelect?: boolean
  primaryLabel: string
  secondaryLabel: string
  actionLabel?: string | null
  actionDisabled?: boolean
  onBack: () => void
  onRename?: () => void
  onRemove?: () => void
  onPrimaryPress?: () => void
  onSecondaryPress?: () => void
  onActionPress?: () => void
  onToggleSelect?: () => void
}

export default ({
  statusBarHeight,
  cover,
  name,
  metaText,
  eyebrow,
  sectionTitle,
  sectionMeta,
  canRename,
  canSelect = false,
  primaryLabel,
  secondaryLabel,
  actionLabel,
  actionDisabled = false,
  onBack,
  onRename,
  onRemove,
  onPrimaryPress,
  onSecondaryPress,
  onActionPress,
  onToggleSelect,
}: PlaylistDetailHeaderProps) => {
  const styles = useLuxStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const t = useI18n()

  return (
    <View style={{ paddingTop: statusBarHeight }}>
      <MagTopBar
        onBack={onBack}
        trailing={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {canSelect && onToggleSelect
              ? (
                <IconButton
                  name="checkbox-multiple-outline"
                  size={22}
                  accessibilityLabel={t('library_select_manage')}
                  onPress={onToggleSelect}
                />
                )
              : null}
            {canRename
              ? (
                <>
                  <IconButton
                    name="pencil-outline"
                    size={22}
                    accessibilityLabel={t('list_rename')}
                    onPress={onRename}
                  />
                  <IconButton
                    name="trash-can-outline"
                    size={22}
                    accessibilityLabel={t('list_remove')}
                    onPress={onRemove}
                  />
                </>
                )
              : null}
          </View>
        }
      />

      <View style={styles.hero}>
        <View style={[styles.cover, { backgroundColor: r.placeholder }]}>
          {cover
            ? <Image style={styles.coverImage} url={cover} />
            : (
              <View style={[styles.coverImage, styles.coverFallback]}>
                <MdiIcon name="music-note-eighth" size={36} color={r.quiet} />
              </View>
              )}
        </View>
        <View style={styles.heroText}>
          <Text size={magType.eyebrow.size} color={r.eyebrow} style={styles.eyebrow} numberOfLines={1}>{eyebrow}</Text>
          <Text size={magType.h2.size} color={r.display} style={styles.title} numberOfLines={2}>{name}</Text>
          <Text size={magType.meta.size} color={r.muted} style={styles.meta} numberOfLines={2}>{metaText}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <PrimaryButton
          label={primaryLabel}
          icon="play"
          onPress={onPrimaryPress}
          style={{ flex: 1 }}
        />
        <SecondaryButton
          label={secondaryLabel}
          icon="shuffle-variant"
          onPress={onSecondaryPress}
          style={{ flex: 1 }}
        />
        {actionLabel
          ? (
            <TextButton
              label={actionLabel}
              onPress={actionDisabled ? undefined : onActionPress}
              disabled={actionDisabled}
            />
            )
          : null}
      </View>

      <SectionHeader
        title={sectionTitle}
        meta={sectionMeta}
        compactRule
        style={{ marginTop: 8 }}
      />
    </View>
  )
}

/** Selecting-mode header chrome used by PlaylistDetailView. */
export const PlaylistSelectHeader = ({
  statusBarHeight,
  cancelLabel,
  selectAllLabel,
  eyebrow,
  title,
  tabs,
  mode,
  onCancel,
  onSelectAll,
  onModeChange,
}: {
  statusBarHeight: number
  cancelLabel: string
  selectAllLabel: string
  eyebrow: string
  title: string
  tabs: Array<{ id: string, label: string }>
  mode: string
  onCancel: () => void
  onSelectAll: () => void
  onModeChange: (id: string) => void
}) => {
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  return (
    <View style={{ paddingTop: statusBarHeight + 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 40 }}>
        <TextButton label={cancelLabel} muted underline={false} onPress={onCancel} />
        <TextButton label={selectAllLabel} onPress={onSelectAll} />
      </View>
      <Text size={magType.eyebrow.size} color={r.eyebrow} style={{ fontWeight: '700', letterSpacing: 1, marginTop: 18 }}>
        {eyebrow}
      </Text>
      <Text size={magType.h2.size} color={r.display} style={{ fontWeight: '800', letterSpacing: -0.8, marginTop: 8 }}>
        {title}
      </Text>
      <TextTabs
        items={tabs}
        value={mode}
        onChange={onModeChange}
        style={{ marginTop: 18 }}
      />
    </View>
  )
}

const useLuxStyles = sharedLuxStyles(() => createStyle({
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 18,
    gap: 14,
  },
  cover: {
    width: 116,
    height: 116,
    borderRadius: 6,
    overflow: 'hidden',
  },
  coverImage: {
    width: 116,
    height: 116,
    borderRadius: 6,
  },
  coverFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: {
    fontWeight: '800',
    letterSpacing: -0.8,
    marginTop: 6,
  },
  meta: {
    marginTop: 6,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
}))
