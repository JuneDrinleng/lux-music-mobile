/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { type LayoutChangeEvent, View } from 'react-native'
import { setSystemBarIconStyle } from '@/utils/nativeModules/utils'
import Content from './Content'
import { Dock, DockPlayerSlot, type DockNavItem } from '@/components/magazine'
import Image from '@/components/common/Image'
import PlayQueueSheet from './PlayQueueSheet'
import PlayDetailOverlay from './PlayDetailOverlay'
import StatusBar from '@/components/common/StatusBar'
import PlaylistDetailView from '@/components/playlist/PlaylistDetailView'
import LocalSongsDetail from '@/components/playlist/LocalSongsDetail'
import ListeningStatsPage from '@/components/stats/ListeningStatsPage'
import useSystemGestureInsetBottom from '@/utils/hooks/useSystemGestureInsetBottom'
import { createStyle } from '@/utils/tools'
import { useComponentIds, useNavActiveId } from '@/store/common/hook'
import { type PlaylistDetailPayload } from '@/event/appEvent'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { type LuxColors } from '@/theme/luxTokens'
import { shouldHoldSplashChrome, subscribeHomeBootSplashHidden } from '@/utils/homeFirstScreenBoot'
import { setNavActiveId } from '@/core/common'
import type { InitState } from '@/store/common/state'
import { useI18n } from '@/lang'
import { useIsPlay, usePlayerMusicInfo, useProgress } from '@/store/player/hook'
import { togglePlay } from '@/core/player/player'
import { useKeyboard } from '@/utils/hooks'
import { useSettingValue } from '@/store/setting/hook'

const useLuxStyles = sharedLuxStyles((colors: LuxColors) => (createStyle({
  container: {
    flex: 1,
    backgroundColor: colors.bg.app,
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
  cover: {
    width: 44,
    height: 44,
    borderRadius: 4,
  },
})))

type TabId = InitState['navActiveId']

export default () => {
  const styles = useLuxStyles()
  const { mode } = useLuxTheme()
  const t = useI18n()

  const bottomInset = useSystemGestureInsetBottom()
  const componentIds = useComponentIds()
  const activeId = useNavActiveId()
  const musicInfo = usePlayerMusicInfo()
  const { progress } = useProgress()
  const isPlay = useIsPlay()
  const { keyboardShown } = useKeyboard()
  const autoHidePlayBar = useSettingValue('common.autoHidePlayBar')
  const [playlistDetailRequest, setPlaylistDetailRequest] = useState<PlaylistDetailPayload | null>(null)
  const [localSongsOpen, setLocalSongsOpen] = useState(false)
  const [listeningStatsOpen, setListeningStatsOpen] = useState(false)
  const [bottomLayerHeight, setBottomLayerHeight] = useState(0)
  const [holdSplashChrome, setHoldSplashChrome] = useState(shouldHoldSplashChrome)

  useEffect(() => subscribeHomeBootSplashHidden(() => { setHoldSplashChrome(false) }), [])

  useEffect(() => {
    setSystemBarIconStyle(holdSplashChrome ? 'dark' : (mode === 'dark' ? 'light' : 'dark'))
  }, [holdSplashChrome, mode])

  useEffect(() => {
    const handleOpenPlaylistDetail = (payload: PlaylistDetailPayload) => {
      setLocalSongsOpen(false)
      setListeningStatsOpen(false)
      setPlaylistDetailRequest(payload)
    }
    const handleClosePlaylistDetail = () => {
      setPlaylistDetailRequest(null)
    }
    const handleOpenLocalSongs = () => {
      setPlaylistDetailRequest(null)
      setListeningStatsOpen(false)
      setLocalSongsOpen(true)
    }
    const handleCloseLocalSongs = () => {
      setLocalSongsOpen(false)
    }
    const handleOpenListeningStats = () => {
      setPlaylistDetailRequest(null)
      setLocalSongsOpen(false)
      setListeningStatsOpen(true)
    }
    const handleCloseListeningStats = () => {
      setListeningStatsOpen(false)
    }
    global.app_event.on('openPlaylistDetail', handleOpenPlaylistDetail)
    global.app_event.on('closePlaylistDetail', handleClosePlaylistDetail)
    global.app_event.on('openLocalSongs', handleOpenLocalSongs)
    global.app_event.on('closeLocalSongs', handleCloseLocalSongs)
    global.app_event.on('openListeningStats', handleOpenListeningStats)
    global.app_event.on('closeListeningStats', handleCloseListeningStats)
    return () => {
      global.app_event.off('openPlaylistDetail', handleOpenPlaylistDetail)
      global.app_event.off('closePlaylistDetail', handleClosePlaylistDetail)
      global.app_event.off('openLocalSongs', handleOpenLocalSongs)
      global.app_event.off('closeLocalSongs', handleCloseLocalSongs)
      global.app_event.off('openListeningStats', handleOpenListeningStats)
      global.app_event.off('closeListeningStats', handleCloseListeningStats)
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

  const handleCloseListeningStats = useCallback(() => {
    setListeningStatsOpen(false)
    global.app_event.closeListeningStats()
  }, [])

  const navItems = useMemo<readonly DockNavItem[]>(() => [
    { id: 'nav_search', icon: 'home-variant-outline', label: t('nav_search') },
    { id: 'nav_love', icon: 'folder-music-outline', label: t('nav_love') },
    { id: 'nav_setting', icon: 'cog-outline', label: t('nav_setting') },
  ], [t])

  const handleNavPress = useCallback((id: string) => {
    global.app_event.closeVerticalSearchPage()
    if (id === 'nav_search' && activeId === id) {
      global.app_event.closePlaylistDetail()
      return
    }
    if (activeId === id) return
    setNavActiveId(id as TabId)
  }, [activeId])

  const normalizedProgress = useMemo(() => {
    if (!musicInfo.id || !Number.isFinite(progress)) return 0
    if (progress <= 0) return 0
    if (progress >= 1) return 1
    return progress
  }, [musicInfo.id, progress])

  const showPlayDetail = useCallback(() => {
    if (!musicInfo.id) return
    global.app_event.showPlayDetail()
  }, [musicInfo.id])

  const keepPlayBarOnKeyboard = Reflect.get(global.lx, 'keepPlayBarOnKeyboard') === true
  const hideDock = autoHidePlayBar && keyboardShown && !keepPlayBarOnKeyboard

  const subtitle = [musicInfo.singer, musicInfo.album].filter(Boolean).join(' · ')

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
      {listeningStatsOpen
        ? <View pointerEvents="box-none" style={styles.playlistDetailLayer}>
            <ListeningStatsPage
              onClose={handleCloseListeningStats}
              bottomPadding={bottomLayerHeight}
            />
          </View>
        : null}
      {hideDock
        ? null
        : (
          <View
            style={styles.bottomLayer}
            pointerEvents="box-none"
            onLayout={(e: LayoutChangeEvent) => { setBottomLayerHeight(e.nativeEvent.layout.height) }}
          >
            <Dock
              progress={normalizedProgress}
              insetBottom={bottomInset}
              navItems={navItems}
              activeNavId={activeId}
              onNavPress={handleNavPress}
              player={
                <DockPlayerSlot
                  title={musicInfo.name || t('player_bar_not_playing')}
                  subtitle={subtitle || t('player_bar_choose_song')}
                  playing={isPlay}
                  onPlayPress={togglePlay}
                  onQueuePress={() => { global.app_event.togglePlayQueuePanel() }}
                  onOpen={showPlayDetail}
                  cover={<Image url={musicInfo.pic} style={styles.cover} />}
                />
              }
            />
          </View>
          )}
      <PlayQueueSheet systemGestureInsetBottom={bottomInset} enabled={!componentIds.playDetail} />
      <PlayDetailOverlay componentId={componentIds.home ?? ''} />
    </View>
  )
}
