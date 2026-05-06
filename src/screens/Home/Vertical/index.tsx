/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

import { useCallback, useEffect, useState } from 'react'
import { View } from 'react-native'
import Content from './Content'
import PlayerBar from '@/components/player/PlayerBar'
import BottomNav from './BottomNav'
import PlayQueueSheet from './PlayQueueSheet'
import StatusBar from '@/components/common/StatusBar'
import PlaylistDetailOverlay from '@/components/playlist/PlaylistDetailOverlay'
import useSystemGestureInsetBottom from '@/utils/hooks/useSystemGestureInsetBottom'
import { createStyle } from '@/utils/tools'
import { useComponentIds } from '@/store/common/hook'
import { type PlaylistDetailPayload } from '@/event/appEvent'
import { APP_LAYER_INDEX } from '@/config/constant'

const styles = createStyle({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  playlistDetailLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: APP_LAYER_INDEX.controls,
    elevation: 0,
  },
  bottomLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 21,
    elevation: 21,
    backgroundColor: 'transparent',
  },
  playerWrap: {
    marginBottom: 6,
  },
  navShell: {
    backgroundColor: 'transparent',
    overflow: 'visible',
    shadowColor: '#000000',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
})

export default () => {
  const bottomInset = useSystemGestureInsetBottom()
  const componentIds = useComponentIds()
  const [playlistDetailRequest, setPlaylistDetailRequest] = useState<PlaylistDetailPayload | null>(null)

  useEffect(() => {
    const handleOpenPlaylistDetail = (payload: PlaylistDetailPayload) => {
      setPlaylistDetailRequest(payload)
    }
    const handleClosePlaylistDetail = () => {
      setPlaylistDetailRequest(null)
    }
    global.app_event.on('openPlaylistDetail', handleOpenPlaylistDetail)
    global.app_event.on('closePlaylistDetail', handleClosePlaylistDetail)
    return () => {
      global.app_event.off('openPlaylistDetail', handleOpenPlaylistDetail)
      global.app_event.off('closePlaylistDetail', handleClosePlaylistDetail)
    }
  }, [])

  const handleClosePlaylistDetail = useCallback(() => {
    setPlaylistDetailRequest(null)
  }, [])

  return (
    <View style={styles.container}>
      <StatusBar />
      <Content />
      {playlistDetailRequest
        ? <View pointerEvents="box-none" style={styles.playlistDetailLayer}>
            <PlaylistDetailOverlay
              detail={playlistDetailRequest}
              onClose={handleClosePlaylistDetail}
            />
          </View>
        : null}
      <View style={styles.bottomLayer} pointerEvents="box-none">
        <View style={styles.playerWrap}>
          <PlayerBar isHome systemGestureInsetBottom={bottomInset} />
        </View>
        <View style={styles.navShell}>
          <BottomNav bottomInset={bottomInset} />
        </View>
      </View>
      <PlayQueueSheet systemGestureInsetBottom={bottomInset} enabled={!componentIds.playDetail} />
    </View>
  )
}
