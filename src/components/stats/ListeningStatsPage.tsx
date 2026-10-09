/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { useCallback } from 'react'
import { Animated, useWindowDimensions } from 'react-native'

import { useOverlaySlideTransition } from '@/components/common/overlaySlideTransition'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { createStyle } from '@/utils/tools'
import { useBackHandler } from '@/utils/hooks/useBackHandler'

import { ListeningStatsMagazine } from './ListeningStatsMagazine'
import { ListeningStatsReplay } from './ListeningStatsReplay'
import { useListeningStatsModel } from './useListeningStatsModel'

const useRootStyles = sharedLuxStyles((colors) => {
  const r = magazineRoles(colors)
  return createStyle({
    root: {
      flex: 1,
      backgroundColor: r.paper,
    },
  })
})

export interface ListeningStatsPageProps {
  onClose: () => void
  bottomPadding?: number
}

const ListeningStatsPage = ({ onClose, bottomPadding = 0 }: ListeningStatsPageProps) => {
  const styles = useRootStyles()
  useLuxTheme()
  const { width } = useWindowDimensions()
  const { style: sceneStyle, requestClose: animateClose } = useOverlaySlideTransition(width)
  const model = useListeningStatsModel()

  const requestClose = useCallback(() => {
    animateClose(onClose)
  }, [animateClose, onClose])

  useBackHandler(useCallback(() => {
    requestClose()
    return true
  }, [requestClose]))

  return (
    <Animated.View style={[styles.root, sceneStyle]}>
      {model.pageStyle == 'replay'
        ? <ListeningStatsReplay model={model} onClose={requestClose} bottomPadding={bottomPadding} />
        : <ListeningStatsMagazine model={model} onClose={requestClose} bottomPadding={bottomPadding} />}
    </Animated.View>
  )
}

export default ListeningStatsPage
