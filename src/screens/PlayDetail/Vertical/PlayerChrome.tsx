/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo, useState } from 'react'
import { TouchableOpacity, useWindowDimensions, View } from 'react-native'

import { MdiIcon } from '@/components/common/MdiIcon'
import { TextTabs, type MagTabItem } from '@/components/magazine'
import { useI18n } from '@/lang'
import { useStatusbarHeight } from '@/store/common/hook'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { magType, PAGE_GUTTER } from '@/theme/magazineType'
import { setSpText } from '@/utils/pixelRatio'
import { createStyle } from '@/utils/tools'

import SleepTimerBtn from './SleepTimerBtn'

export const PLAYER_ICON_TAP = 44

export type PlayerPageId = 'comment' | 'play' | 'lyric'

export const PlayerChrome = memo(({
  page,
  onPageChange,
  onBack,
  onShare,
}: {
  page: PlayerPageId
  onPageChange: (id: PlayerPageId) => void
  onBack: () => void
  onShare: () => void
}) => {
  const styles = useStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const statusBarHeight = useStatusbarHeight()
  const t = useI18n()
  const { width } = useWindowDimensions()
  const [measuredTabsWidth, setTabsWidth] = useState(0)
  // Six CJK glyphs at 15 plus two gaps until the row reports its actual width.
  const tabsWidth = measuredTabsWidth || 6 * setSpText(15) + 2 * styles.tabsInner.gap

  const tabs: MagTabItem[] = [
    { id: 'comment', label: t('player_tab_comment') },
    { id: 'play', label: t('player_tab_play') },
    { id: 'lyric', label: t('player_tab_lyric') },
  ]

  return (
    <View style={[styles.wrap, { paddingTop: statusBarHeight + 8 }]}>
      <TouchableOpacity
        style={styles.backBtn}
        activeOpacity={0.7}
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel={t('back')}
      >
        <MdiIcon name="chevron-down" size={22} color={r.ink} />
      </TouchableOpacity>
      <View pointerEvents="box-none" style={[styles.tabs, { top: statusBarHeight + 8 }]}>
        <View onLayout={({ nativeEvent }) => { setTabsWidth(nativeEvent.layout.width) }}>
          <TextTabs
            items={tabs}
            value={page}
            onChange={(id) => { onPageChange(id as PlayerPageId) }}
            style={styles.tabsInner}
            tabStyle={styles.tab}
            labelStyle={styles.tabLabel}
          />
        </View>
      </View>
      <View style={styles.actions}>
        <SleepTimerBtn layout={{ windowWidth: width, tabsWidth, shareWidth: styles.iconBtn.width, gutter: styles.wrap.paddingHorizontal }} />
        <TouchableOpacity
          style={styles.iconBtn}
          activeOpacity={0.7}
          onPress={onShare}
          accessibilityRole="button"
          accessibilityLabel={t('player_share')}
        >
          <MdiIcon name="share-variant-outline" size={22} color={r.ink} />
        </TouchableOpacity>
      </View>
    </View>
  )
})

const useStyles = sharedLuxStyles((colors) => {
  const r = magazineRoles(colors)
  return createStyle({
    wrap: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: PAGE_GUTTER,
      zIndex: 2,
    },
    backBtn: {
      width: PLAYER_ICON_TAP,
      height: PLAYER_ICON_TAP,
      borderRadius: PLAYER_ICON_TAP / 2,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: r.ink,
      backgroundColor: 'transparent',
    },
    tabs: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: PLAYER_ICON_TAP,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabsInner: {
      borderBottomWidth: 0,
      gap: 20,
    },
    tab: {
      paddingBottom: 6,
    },
    tabLabel: {
      lineHeight: magType.tab.lineHeight,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    iconBtn: {
      width: PLAYER_ICON_TAP,
      height: PLAYER_ICON_TAP,
      alignItems: 'center',
      justifyContent: 'center',
    },
  })
})
