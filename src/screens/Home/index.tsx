/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

import { useCallback, useEffect } from 'react'
import { View } from 'react-native'
import { Navigation } from 'react-native-navigation'
import { useHorizontalMode } from '@/utils/hooks'
import PageContent from '@/components/PageContent'
import { setComponentId } from '@/core/common'
import { COMPONENT_IDS } from '@/config/constant'
import Vertical from './Vertical'
import Horizontal from './Horizontal'
import { getStatusBarStyle, navigations, useNavigationComponentDidAppear } from '@/navigation'
import settingState from '@/store/setting/state'
import PermissionPromptHost from '@/components/PermissionPromptHost'
import AppDialogHost from '@/components/AppDialogHost'
import { MagToastHost } from '@/components/magazine'
import themeState from '@/store/theme/state'
import { useLuxTheme } from '@/theme/LuxTheme'
import HomeBootSplash from '@/screens/Launch/HomeBootSplash'
import { subscribeHomeBootReveal } from '@/utils/homeFirstScreenBoot'


interface Props {
  componentId: string
}


export default ({ componentId }: Props) => {
  const { colors } = useLuxTheme()
  const isHorizontalMode = useHorizontalMode()
  const applySystemBarOptions = useCallback(() => {
    const theme = themeState.theme
    Navigation.mergeOptions(componentId, {
      statusBar: {
        drawBehind: true,
        visible: true,
        style: getStatusBarStyle(theme.isDark),
        backgroundColor: 'transparent',
      },
      navigationBar: {
        drawBehind: true,
        backgroundColor: 'transparent',
      },
    })
  }, [componentId])

  useNavigationComponentDidAppear(componentId, applySystemBarOptions)

  useEffect(() => {
    setComponentId(COMPONENT_IDS.home, componentId)
    applySystemBarOptions()
    // eslint-disable-next-line react-hooks/exhaustive-deps

    if (!settingState.setting['player.startupPushPlayDetailScreen']) return
    return subscribeHomeBootReveal(() => {
      navigations.pushPlayDetailScreen(componentId, true)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applySystemBarOptions, componentId])

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.app }}>
      <PageContent>
        {
          isHorizontalMode
            ? <Horizontal />
            : <Vertical />
        }
        <AppDialogHost />
        <PermissionPromptHost />
        <MagToastHost />
      </PageContent>
      <HomeBootSplash />
    </View>
  )
}
