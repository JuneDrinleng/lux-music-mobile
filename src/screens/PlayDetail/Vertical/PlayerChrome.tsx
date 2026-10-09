/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo } from 'react'
import { TouchableOpacity, View } from 'react-native'

import { MdiIcon } from '@/components/common/MdiIcon'
import { TextTabs, type MagTabItem } from '@/components/magazine'
import { useI18n } from '@/lang'
import { useStatusbarHeight } from '@/store/common/hook'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { PAGE_GUTTER } from '@/theme/magazineType'
import { createStyle } from '@/utils/tools'

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
      <View style={styles.tabs}>
        <TextTabs
          items={tabs}
          value={page}
          onChange={(id) => { onPageChange(id as PlayerPageId) }}
          small
          style={styles.tabsInner}
        />
      </View>
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
  )
})

const useStyles = sharedLuxStyles((colors) => {
  const r = magazineRoles(colors)
  return createStyle({
    wrap: {
      flexDirection: 'row',
      alignItems: 'center',
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
      flex: 1,
      alignItems: 'center',
      paddingHorizontal: 8,
    },
    tabsInner: {
      borderBottomWidth: 0,
      gap: 18,
    },
    iconBtn: {
      width: PLAYER_ICON_TAP,
      height: PLAYER_ICON_TAP,
      alignItems: 'center',
      justifyContent: 'center',
    },
  })
})
