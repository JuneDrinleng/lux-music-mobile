/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

import { useCallback, useEffect, useState } from 'react'
import { type LayoutChangeEvent, View } from 'react-native'
import { setSystemBarIconStyle } from '@/utils/nativeModules/utils'
import Content from './Content'
import PlayerBar from '@/components/player/PlayerBar'
import BottomNav from './BottomNav'
import PlayQueueSheet from './PlayQueueSheet'
import PlayDetailOverlay from './PlayDetailOverlay'
import StatusBar from '@/components/common/StatusBar'
import PlaylistDetailView from '@/components/playlist/PlaylistDetailView'
import LocalSongsDetail from '@/components/playlist/LocalSongsDetail'
import useSystemGestureInsetBottom from '@/utils/hooks/useSystemGestureInsetBottom'
import { createStyle } from '@/utils/tools'
import { useComponentIds } from '@/store/common/hook'
import { type PlaylistDetailPayload } from '@/event/appEvent'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { type LuxColors } from '@/theme/luxTokens'
import { shouldHoldSplashChrome, subscribeHomeBootSplashHidden } from '@/utils/homeFirstScreenBoot'

const useLuxStyles = sharedLuxStyles((colors: LuxColors) => (createStyle({
  container: {
    flex: 1,
    backgroundColor: colors.bg.plain,
  },
  playlistDetailLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 27,
    elevation: 0,
  },
  bottomLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 28,
    elevation: 21,
    backgroundColor: 'transparent',
  },
  playerWrap: {
    marginBottom: 6,
  },
  navShell: {
    backgroundColor: 'transparent',
    overflow: 'visible',
    shadowColor: colors.shadow.black,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
})))

export default () => {
  const styles = useLuxStyles()
  const { mode } = useLuxTheme()

  const bottomInset = useSystemGestureInsetBottom()
  const componentIds = useComponentIds()
  const [playlistDetailRequest, setPlaylistDetailRequest] = useState<PlaylistDetailPayload | null>(null)
  const [localSongsOpen, setLocalSongsOpen] = useState(false)
  const [bottomLayerHeight, setBottomLayerHeight] = useState(0)
  const [holdSplashChrome, setHoldSplashChrome] = useState(shouldHoldSplashChrome)

  useEffect(() => subscribeHomeBootSplashHidden(() => { setHoldSplashChrome(false) }), [])

  useEffect(() => {
    // The splash artwork is still the light launch screen. Keep dark glyphs until it fades.
    setSystemBarIconStyle(holdSplashChrome ? 'dark' : (mode === 'dark' ? 'light' : 'dark'))
  }, [holdSplashChrome, mode])

  useEffect(() => {
    const handleOpenPlaylistDetail = (payload: PlaylistDetailPayload) => {
      setPlaylistDetailRequest(payload)
    }
    const handleClosePlaylistDetail = () => {
      setPlaylistDetailRequest(null)
    }
    const handleOpenLocalSongs = () => {
      setPlaylistDetailRequest(null)
      setLocalSongsOpen(true)
    }
    const handleCloseLocalSongs = () => {
      setLocalSongsOpen(false)
    }
    global.app_event.on('openPlaylistDetail', handleOpenPlaylistDetail)
    global.app_event.on('closePlaylistDetail', handleClosePlaylistDetail)
    global.app_event.on('openLocalSongs', handleOpenLocalSongs)
    global.app_event.on('closeLocalSongs', handleCloseLocalSongs)
    return () => {
      global.app_event.off('openPlaylistDetail', handleOpenPlaylistDetail)
      global.app_event.off('closePlaylistDetail', handleClosePlaylistDetail)
      global.app_event.off('openLocalSongs', handleOpenLocalSongs)
      global.app_event.off('closeLocalSongs', handleCloseLocalSongs)
    }
  }, [])

  const handleClosePlaylistDetail = useCallback(() => {
    setPlaylistDetailRequest(null)
    global.app_event.closePlaylistDetail()
  }, [])

  const handleCloseLocalSongs = useCallback(() => {
    setLocalSongsOpen(false)
    global.app_event.closeLocalSongs()
  }, [])

  return (
    <View style={styles.container}>
      <StatusBar barStyle={holdSplashChrome || mode !== 'dark' ? 'dark-content' : 'light-content'} />
      <Content />
      {playlistDetailRequest
        ? <View pointerEvents="box-none" style={styles.playlistDetailLayer}>
            <PlaylistDetailView
              detail={playlistDetailRequest}
              onClose={handleClosePlaylistDetail}
              bottomPadding={bottomLayerHeight}
            />
          </View>
        : null}
      {localSongsOpen
        ? <View pointerEvents="box-none" style={styles.playlistDetailLayer}>
            <LocalSongsDetail
              onClose={handleCloseLocalSongs}
              bottomPadding={bottomLayerHeight}
            />
          </View>
        : null}
      <View
        style={styles.bottomLayer}
        pointerEvents="box-none"
        onLayout={(e: LayoutChangeEvent) => { setBottomLayerHeight(e.nativeEvent.layout.height) }}
      >
        <View style={styles.playerWrap}>
          <PlayerBar isHome systemGestureInsetBottom={bottomInset} />
        </View>
        <View style={styles.navShell}>
          <BottomNav bottomInset={bottomInset} />
        </View>
      </View>
      <PlayQueueSheet systemGestureInsetBottom={bottomInset} enabled={!componentIds.playDetail} />
      <PlayDetailOverlay componentId={componentIds.home ?? ''} />
    </View>
  )
}
