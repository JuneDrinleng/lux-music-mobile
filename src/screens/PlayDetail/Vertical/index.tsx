/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { AppState, View } from 'react-native'
import PagerView, { type PagerViewOnPageSelectedEvent } from 'react-native-pager-view'
import Lyric from './Lyric'
import Pic from './Pic'
import { PlayerChrome, type PlayerPageId } from './PlayerChrome'
import Comment from '@/screens/Comment'
import { usePlayDetailClose } from '../context'
import { useBackHandler } from '@/utils/hooks/useBackHandler'
import { screenkeepAwake, screenUnkeepAwake } from '@/utils/nativeModules/utils'
import { shareMusic, createStyle } from '@/utils/tools'
import { usePlayMusicInfo } from '@/store/player/hook'
import { useSettingValue } from '@/store/setting/hook'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'

const PAGE_IDS: PlayerPageId[] = ['comment', 'play', 'lyric']

export default memo(({
  componentId,
}: {
  componentId: string
}) => {
  const styles = useLuxStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const closePlayDetail = usePlayDetailClose()
  const playMusicInfo = usePlayMusicInfo()
  const shareType = useSettingValue('common.shareType')
  const downloadFileName = useSettingValue('download.fileName')

  const [pageIndex, setPageIndex] = useState(1)
  const [commentRefreshKey, setCommentRefreshKey] = useState(0)
  const showLyricRef = useRef(false)
  const pagerViewRef = useRef<PagerView>(null)

  const pageId = PAGE_IDS[pageIndex] ?? 'play'

  const triggerCommentRefresh = useCallback(() => {
    setCommentRefreshKey(k => k + 1)
  }, [])

  const setPage = useCallback((index: number) => {
    pagerViewRef.current?.setPage(index)
  }, [])

  const handlePageChange = useCallback((id: PlayerPageId) => {
    const index = PAGE_IDS.indexOf(id)
    if (index < 0 || index === pageIndex) return
    setPage(index)
  }, [pageIndex, setPage])

  const handleShare = useCallback(() => {
    const currentMusicInfo = playMusicInfo.musicInfo
    if (!currentMusicInfo) return
    const targetMusicInfo = 'progress' in currentMusicInfo ? currentMusicInfo.metadata.musicInfo : currentMusicInfo
    shareMusic(shareType, downloadFileName, targetMusicInfo)
  }, [downloadFileName, playMusicInfo.musicInfo, shareType])

  const onPageSelected = ({ nativeEvent }: PagerViewOnPageSelectedEvent) => {
    const position = nativeEvent.position
    setPageIndex(position)
    showLyricRef.current = position === 2
    if (showLyricRef.current) screenkeepAwake()
    else screenUnkeepAwake()
    if (position === 0) triggerCommentRefresh()
  }

  useBackHandler(useCallback(() => {
    if (pageIndex === 0) {
      setPage(1)
      return true
    }
    return false
  }, [pageIndex, setPage]))

  useEffect(() => {
    const appstateListener = AppState.addEventListener('change', state => {
      if (state === 'active') {
        if (showLyricRef.current) screenkeepAwake()
      } else if (state === 'background') {
        screenUnkeepAwake()
      }
    })

    return () => {
      appstateListener.remove()
      screenUnkeepAwake()
    }
  }, [])

  return (
    <View style={[styles.container, { backgroundColor: r.paper }]}>
      <PlayerChrome
        page={pageId}
        onPageChange={handlePageChange}
        onBack={closePlayDetail}
        onShare={handleShare}
      />
      <PagerView ref={pagerViewRef} initialPage={1} onPageSelected={onPageSelected} style={styles.pagerView}>
        <View collapsable={false} style={styles.page}>
          <Comment embedded hideChrome onBack={() => { setPage(1) }} refreshKey={commentRefreshKey} />
        </View>
        <View collapsable={false} style={styles.page}>
          <Pic componentId={componentId} active={pageIndex === 1} />
        </View>
        <View collapsable={false} style={styles.page}>
          <Lyric active={pageIndex === 2} />
        </View>
      </PagerView>
    </View>
  )
})

const useLuxStyles = sharedLuxStyles(() => (createStyle({
  container: {
    flex: 1,
  },
  pagerView: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
})))
