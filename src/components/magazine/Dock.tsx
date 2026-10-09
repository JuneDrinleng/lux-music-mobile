/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo, useState, type ReactNode } from 'react'
import { TouchableOpacity, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native'

import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { MdiIcon } from '@/components/common/MdiIcon'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { PAGE_GUTTER } from '@/theme/magazineType'
import { createStyle } from '@/utils/tools'

import { Hairline } from './Hairline'
import { IconButton } from './IconButton'

/**
 * Magazine bottom dock shell (§4.16): paper + top ink rule.
 * Player strip (64) + nav (58). Page PRs wire real PlayerBar / BottomNav content into slots.
 */

export const DOCK_PLAYER_HEIGHT = 64
export const DOCK_NAV_HEIGHT = 58
export const DOCK_BASE_HEIGHT = DOCK_PLAYER_HEIGHT + DOCK_NAV_HEIGHT

/** Display-only mini-bar progress (rail + fill + thumb). */
const PROGRESS_TRACK_H = 3
const PROGRESS_THUMB = 9
const PROGRESS_BAND_H = PROGRESS_THUMB
const NAV_ICON_SIZE = 28

const clampProgress = (progress: number) => {
  if (!Number.isFinite(progress)) return 0
  if (progress <= 0) return 0
  if (progress >= 1) return 1
  return progress
}

const useStyles = sharedLuxStyles((colors) => {
  const r = magazineRoles(colors)
  return createStyle({
    dock: {
      backgroundColor: r.paper,
      borderTopWidth: 1,
      borderTopColor: r.ink,
      overflow: 'visible',
    },
    progressBand: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: PROGRESS_BAND_H,
      justifyContent: 'center',
      zIndex: 2,
    },
    progressRail: {
      height: PROGRESS_TRACK_H,
      borderRadius: PROGRESS_TRACK_H / 2,
      width: '100%',
    },
    progressFill: {
      position: 'absolute',
      left: 0,
      height: PROGRESS_TRACK_H,
      borderRadius: PROGRESS_TRACK_H / 2,
    },
    progressThumb: {
      position: 'absolute',
      width: PROGRESS_THUMB,
      height: PROGRESS_THUMB,
      borderRadius: PROGRESS_THUMB / 2,
      borderWidth: 1.5,
      top: (PROGRESS_BAND_H - PROGRESS_THUMB) / 2,
    },
    player: {
      height: DOCK_PLAYER_HEIGHT,
      paddingHorizontal: PAGE_GUTTER,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    cover: {
      width: 44,
      height: 44,
      borderRadius: 4,
      backgroundColor: r.placeholder,
    },
    text: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      fontWeight: '700',
    },
    playBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: r.ink,
      alignItems: 'center',
      justifyContent: 'center',
    },
    nav: {
      height: DOCK_NAV_HEIGHT,
      flexDirection: 'row',
    },
    navItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    navMark: {
      position: 'absolute',
      top: 0,
      width: 24,
      height: 3,
      borderRadius: 2,
      backgroundColor: r.accent,
    },
  })
})

export interface DockNavItem {
  id: string
  icon: string
  label: string
}

const DockProgress = memo(({ progress }: { progress: number }) => {
  const styles = useStyles()
  const { colors, mode } = useLuxTheme()
  const r = magazineRoles(colors)
  const [bandW, setBandW] = useState(0)
  const ratio = clampProgress(progress)
  const travel = Math.max(0, bandW - PROGRESS_THUMB)
  const thumbLeft = ratio * travel
  const fillWidth = bandW > 0 ? thumbLeft + PROGRESS_THUMB / 2 : 0

  const onLayout = (event: LayoutChangeEvent) => {
    setBandW(event.nativeEvent.layout.width)
  }

  return (
    <View
      pointerEvents="none"
      style={styles.progressBand}
      onLayout={onLayout}
    >
      <View style={[styles.progressRail, { backgroundColor: r.hairline }]} />
      <View style={[styles.progressFill, { width: fillWidth, backgroundColor: r.accent }]} />
      {bandW > 0
        ? (
          <View
            style={[
              styles.progressThumb,
              {
                left: thumbLeft,
                backgroundColor: r.accent,
                borderColor: mode === 'dark' ? r.paper : r.ink,
              },
            ]}
          />
          )
        : null}
    </View>
  )
})

export const Dock = memo(({
  children,
  progress = 0,
  player,
  navItems,
  activeNavId,
  onNavPress,
  insetBottom = 0,
}: {
  children?: ReactNode
  progress?: number
  player?: ReactNode
  navItems?: readonly DockNavItem[]
  activeNavId?: string
  onNavPress?: (id: string) => void
  insetBottom?: number
}) => {
  const styles = useStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  return (
    <View style={[styles.dock, { paddingBottom: insetBottom }]}>
      <DockProgress progress={progress} />
      {player ?? children}
      {navItems?.length
        ? (
          <>
            <Hairline />
            <View style={styles.nav}>
              {navItems.map(item => {
                const on = item.id === activeNavId
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.navItem}
                    activeOpacity={0.7}
                    onPress={() => onNavPress?.(item.id)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={item.label}
                  >
                    {on ? <View style={styles.navMark} /> : null}
                    <MdiIcon name={item.icon} size={NAV_ICON_SIZE} color={on ? r.ink : r.quiet} />
                  </TouchableOpacity>
                )
              })}
            </View>
          </>
          )
        : null}
    </View>
  )
})

export const DockPlayerSlot = memo(({
  title,
  subtitle,
  playing,
  onPlayPress,
  onQueuePress,
  onOpen,
  cover,
}: {
  title: string
  subtitle?: string
  playing?: boolean
  onPlayPress?: () => void
  onQueuePress?: () => void
  onOpen?: () => void
  cover?: ReactNode
}) => {
  const styles = useStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const t = useI18n()
  const handlePlayPress = (event: GestureResponderEvent) => {
    event.stopPropagation()
    onPlayPress?.()
  }
  return (
    <TouchableOpacity style={styles.player} activeOpacity={0.85} onPress={onOpen}>
      {cover ?? <View style={styles.cover} />}
      <View style={styles.text}>
        <Text size={15} color={r.ink} style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle
          ? <Text size={12} color={r.muted} numberOfLines={1}>{subtitle}</Text>
          : null}
      </View>
      <TouchableOpacity
        style={styles.playBtn}
        activeOpacity={0.7}
        onPress={handlePlayPress}
        accessibilityRole="button"
        accessibilityLabel={playing ? t('pause') : t('play')}
      >
        <MdiIcon name={playing ? 'pause' : 'play'} size={22} color={r.onInk} />
      </TouchableOpacity>
      {onQueuePress
        ? (
          <IconButton
            name="playlist-music"
            accessibilityLabel={t('dock_queue')}
            onPress={() => { onQueuePress?.() }}
          />
          )
        : null}
    </TouchableOpacity>
  )
})
