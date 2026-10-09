import { ImageBackground, StyleSheet, TouchableOpacity, View } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'

import { Icon } from '@/components/common/Icon'
import { MdiIcon } from '@/components/common/MdiIcon'
import Text from '@/components/common/Text'
import { createStyle } from '@/utils/tools'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { type LuxColors } from '@/theme/luxTokens'

const BOTTOM_FADE_HEIGHT = 280

const BottomFade = ({ color }: { color: string }) => {
  const styles = useLuxStyles()
  return (
  <View style={styles.bottomFade} pointerEvents="none">
    <Svg width="100%" height="100%">
      <Defs>
        <LinearGradient id="bottomFadeGradient" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0" />
          <Stop offset="0.3" stopColor={color} stopOpacity="0.2" />
          <Stop offset="0.55" stopColor={color} stopOpacity="0.7" />
          <Stop offset="0.8" stopColor={color} stopOpacity="0.95" />
          <Stop offset="1" stopColor={color} stopOpacity="1" />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#bottomFadeGradient)" />
    </Svg>
  </View>
  )
}

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
  actionIcon?: string
  actionDisabled?: boolean
  onBack: () => void
  onRename?: () => void
  onRemove?: () => void
  onActionPress?: () => void
  onToggleSelect?: () => void
  selecting?: boolean
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
  actionIcon = 'import',
  actionDisabled = false,
  onBack,
  onRename,
  onRemove,
  onActionPress,
  onToggleSelect,
  selecting = false,
}: PlaylistDetailHeaderProps) => {
  const styles = useLuxStyles()
  const { colors } = useLuxTheme()

  const appBg = colors.bg.app

  const heroBody = (
    <View style={styles.heroContent}>
      <Text size={22} color={colors.ink.strong} style={styles.heroTitle} numberOfLines={2}>{name}</Text>
      <Text size={12} color={colors.ink.meta} style={styles.heroMeta} numberOfLines={2}>{metaText}</Text>
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
                ? <Text size={11} color={colors.ink.meta} numberOfLines={1} style={styles.sourceLabel}>{sourceLabel}</Text>
                : null}
            </View>
          )
        : null}
    </View>
  )

  return (
    <>
      {cover ? (
        <ImageBackground
          style={[styles.heroBanner, { backgroundColor: appBg }]}
          source={{ uri: cover.startsWith('/') ? `file://${cover}` : cover }}
          resizeMode="cover"
        >
          <View style={styles.heroOverlay} pointerEvents="none" />
          <View style={[styles.topBarPad, { paddingTop: statusBarHeight + 18 }]}>
            <TouchableOpacity style={styles.backButton} activeOpacity={0.82} onPress={() => { onBack() }}>
              <View style={styles.backButtonInner}>
                <Icon name="chevron-left" rawSize={20} color={colors.ink.input} />
              </View>
            </TouchableOpacity>
          </View>
          <BottomFade color={appBg} />
          {heroBody}
        </ImageBackground>
      ) : (
        <>
          <View style={[styles.header, { paddingTop: statusBarHeight + 18 }]}>
            <View style={styles.topBar}>
              <TouchableOpacity style={styles.backButton} activeOpacity={0.82} onPress={() => { onBack() }}>
                <View style={styles.backButtonInner}>
                  <Icon name="chevron-left" rawSize={20} color={colors.ink.input} />
                </View>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.heroArea}>
            <View style={[styles.heroBgFallback, { backgroundColor: appBg }]} />
            <BottomFade color={appBg} />
            {heroBody}
          </View>
        </>
      )}

      <View style={[styles.sectionHeader, { backgroundColor: appBg }]}>
        <Text size={18} color={colors.ink.strong} style={styles.sectionTitle}>{sectionTitle}</Text>
        <View style={styles.sectionActions}>
          {onToggleSelect
            ? (
                <TouchableOpacity style={styles.editButton} activeOpacity={0.8} onPress={onToggleSelect}>
                  <MdiIcon name={selecting ? 'checkbox-marked' : 'checkbox-multiple-outline'} size={15} color={colors.ink.nearBlack} />
                </TouchableOpacity>
              )
            : null}
          {actionLabel
            ? (
                <TouchableOpacity
                  activeOpacity={0.8}
                  disabled={actionDisabled}
                  onPress={onActionPress}
                  style={[
                    styles.actionButton,
                    actionDisabled ? { opacity: 0.4 } : null,
                  ]}
                >
                  <MdiIcon
                    name={actionIcon}
                    size={18}
                    color={colors.ink.nearBlack}
                    style={actionDisabled ? styles.actionIconDisabled : undefined}
                  />
                </TouchableOpacity>
              )
            : null}
          {canRename
            ? (
                <>
                  <TouchableOpacity style={styles.editButton} activeOpacity={0.8} onPress={onRename}>
                    <MdiIcon name="pencil" size={15} color={colors.ink.nearBlack} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.editButton} activeOpacity={0.8} onPress={onRemove}>
                    <MdiIcon name="trash-can" size={15} color={colors.ink.nearBlack} />
                  </TouchableOpacity>
                </>
              )
            : null}
        </View>
      </View>
    </>
  )
}

const useLuxStyles = sharedLuxStyles((colors: LuxColors) => (createStyle({
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
  heroBanner: {
    position: 'relative',
    overflow: 'hidden',
    marginHorizontal: -18,
    marginBottom: 18,
    minHeight: 340,
    justifyContent: 'flex-end',
    backgroundColor: colors.bg.app,
  },
  topBarPad: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 3,
    paddingHorizontal: 18,
    paddingBottom: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface.card,
    padding: 2,
  },
  backButtonInner: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.surface.avatar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroArea: {
    position: 'relative',
    overflow: 'hidden',
    marginHorizontal: -18,
    marginBottom: 18,
    padding: 20,
    minHeight: 300,
    justifyContent: 'flex-end',
  },
  heroBgFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.surface.heroFallback,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.scrim.heroPhoto,
  },
  heroContent: {
    position: 'relative',
    zIndex: 2,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  heroTitle: {
    fontWeight: '800',
  },
  heroMeta: {
    marginTop: 6,
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: -18,
    marginBottom: 14,
    paddingHorizontal: 20,
    backgroundColor: colors.bg.app,
    zIndex: 2,
  },
  sectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  editButton: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontWeight: '700',
  },
  actionButton: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
  },
  editIcon: {
    width: 15,
    height: 15,
    resizeMode: 'contain',
  },
  actionIconDisabled: {
    opacity: 0.4,
  },
  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: BOTTOM_FADE_HEIGHT,
    zIndex: 1,
  },
})))
