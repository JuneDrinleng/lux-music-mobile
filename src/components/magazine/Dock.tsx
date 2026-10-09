/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo, type ReactNode } from 'react'
import { TouchableOpacity, View, type GestureResponderEvent } from 'react-native'

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

const useStyles = sharedLuxStyles((colors) => {
  const r = magazineRoles(colors)
  return createStyle({
    dock: {
      backgroundColor: r.paper,
      borderTopWidth: 1,
      borderTopColor: r.ink,
    },
    player: {
      height: DOCK_PLAYER_HEIGHT,
      paddingHorizontal: PAGE_GUTTER,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    progress: {
      position: 'absolute',
      top: 0,
      left: 0,
      height: 2,
      backgroundColor: r.accent,
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
      gap: 2,
    },
    navMark: {
      position: 'absolute',
      top: 0,
      width: 24,
      height: 3,
      borderRadius: 2,
      backgroundColor: r.accent,
    },
    navLabel: {
      fontWeight: '600',
      fontSize: 11,
    },
    navLabelOn: {
      fontWeight: '800',
      fontSize: 11,
    },
  })
})

export interface DockNavItem {
  id: string
  icon: string
  label: string
}

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
      <View style={[styles.progress, { width: `${Math.max(0, Math.min(1, progress)) * 100}%` }]} />
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
                  >
                    {on ? <View style={styles.navMark} /> : null}
                    <MdiIcon name={item.icon} size={22} color={on ? r.ink : r.quiet} />
                    <Text
                      size={11}
                      color={on ? r.ink : r.quiet}
                      style={on ? styles.navLabelOn : styles.navLabel}
                    >{item.label}</Text>
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
