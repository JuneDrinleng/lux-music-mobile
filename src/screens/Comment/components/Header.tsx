/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo } from 'react'
import { View, TouchableOpacity } from 'react-native'

import { MdiIcon } from '@/components/common/MdiIcon'
import { pop } from '@/navigation'
import StatusBar from '@/components/common/StatusBar'
import { createStyle } from '@/utils/tools'
import commonState from '@/store/common/state'
import { useStatusbarHeight } from '@/store/common/hook'
import { useI18n } from '@/lang'
import { useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { PAGE_GUTTER } from '@/theme/magazineType'
import { PLAYER_ICON_TAP } from '@/screens/PlayDetail/Vertical/PlayerChrome'

export default memo(({ embedded, onBack, onShare }: {
  embedded?: boolean
  onBack?: () => void
  onShare?: () => void
}) => {
  const statusBarHeight = useStatusbarHeight()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const t = useI18n()

  const back = () => {
    if (onBack) {
      onBack()
    } else {
      void pop(commonState.componentIds.comment!)
    }
  }

  return (
    <View style={{ paddingTop: statusBarHeight + 8 }}>
      {!embedded && <StatusBar />}
      <View style={styles.container}>
        <TouchableOpacity
          style={[styles.backBtn, { borderColor: r.ink }]}
          activeOpacity={0.7}
          onPress={back}
          accessibilityLabel={t('back')}
        >
          <MdiIcon name="chevron-down" size={22} color={r.ink} />
        </TouchableOpacity>
        <View style={styles.headerCenter} />
        <TouchableOpacity
          style={styles.headerBtn}
          activeOpacity={0.7}
          onPress={onShare}
          accessibilityLabel={t('player_share')}
        >
          <MdiIcon name="share-variant-outline" size={22} color={r.ink} />
        </TouchableOpacity>
      </View>
    </View>
  )
})

const styles = createStyle({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: PAGE_GUTTER,
  },
  backBtn: {
    width: PLAYER_ICON_TAP,
    height: PLAYER_ICON_TAP,
    borderRadius: PLAYER_ICON_TAP / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  headerBtn: {
    width: PLAYER_ICON_TAP,
    height: PLAYER_ICON_TAP,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
  },
})
