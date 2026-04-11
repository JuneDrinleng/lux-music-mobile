/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

import { useCallback, useEffect } from 'react'
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
import themeState from '@/store/theme/state'


interface Props {
  componentId: string
}


export default ({ componentId }: Props) => {
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

    if (settingState.setting['player.startupPushPlayDetailScreen']) {
      navigations.pushPlayDetailScreen(componentId, true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applySystemBarOptions, componentId])

  return (
    <PageContent>
      {
        isHorizontalMode
          ? <Horizontal />
          : <Vertical />
      }
      <AppDialogHost />
      <PermissionPromptHost />
    </PageContent>
  )
}
