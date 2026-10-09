/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo, useMemo, useEffect, useRef, useState, useCallback } from 'react'
import { View, TouchableOpacity } from 'react-native'
import Header from './components/Header'
import Image from '@/components/common/Image'
import CommentHot from './CommentHot'
import CommentNew from './CommentNew'
import { createStyle, shareMusic } from '@/utils/tools'
import { formatPlayCount } from '@/utils'
import Text from '@/components/common/Text'
import { TextTabs } from '@/components/magazine'
import { useI18n } from '@/lang'
import { COMPONENT_IDS } from '@/config/constant'
import { setComponentId } from '@/core/common'
import PageContent from '@/components/PageContent'
import playerState from '@/store/player/state'
import { usePlayerMusicInfo, usePlayMusicInfo } from '@/store/player/hook'
import { useSettingValue } from '@/store/setting/hook'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { PAGE_GUTTER, magType } from '@/theme/magazineType'
import { PLAYER_ICON_TAP } from '@/screens/PlayDetail/Vertical/PlayerChrome'

type ActiveId = 'hot' | 'new'

const HotCommentPage = memo(({ activeId, musicInfo, onUpdateTotal, refreshKey }: {
  activeId: ActiveId
  musicInfo: LX.Music.MusicInfoOnline
  onUpdateTotal: (total: number) => void
  refreshKey: number
}) => {
  const initedRef = useRef(false)
  const el = <CommentHot musicInfo={musicInfo} onUpdateTotal={onUpdateTotal} refreshKey={refreshKey} />
  switch (activeId) {
    case 'hot':
      if (!initedRef.current) initedRef.current = true
      return el
    default:
      return initedRef.current ? el : null
  }
})

const NewCommentPage = memo(({ activeId, musicInfo, onUpdateTotal, refreshKey }: {
  activeId: ActiveId
  musicInfo: LX.Music.MusicInfoOnline
  onUpdateTotal: (total: number) => void
  refreshKey: number
}) => {
  const initedRef = useRef(false)
  const el = <CommentNew musicInfo={musicInfo} onUpdateTotal={onUpdateTotal} refreshKey={refreshKey} />
  switch (activeId) {
    case 'new':
      if (!initedRef.current) initedRef.current = true
      return el
    default:
      return initedRef.current ? el : null
  }
})

const getMusicInfo = (musicInfo: LX.Player.PlayMusic | null) => {
  if (!musicInfo) return null
  return 'progress' in musicInfo ? musicInfo.metadata.musicInfo : musicInfo
}

export default memo(({ componentId, embedded, hideChrome, onBack, refreshKey = 0 }: {
  componentId?: string
  embedded?: boolean
  hideChrome?: boolean
  onBack?: () => void
  refreshKey?: number
}) => {
  const styles = useLuxStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const [activeId, setActiveId] = useState<ActiveId>('hot')
  const [musicInfo, setMusicInfo] = useState<LX.Music.MusicInfo | null>(getMusicInfo(playerState.playMusicInfo.musicInfo))
  const [internalRefreshKey, setInternalRefreshKey] = useState(0)
  const combinedRefreshKey = refreshKey + internalRefreshKey
  const t = useI18n()
  const [total, setTotal] = useState({ hot: 0, new: 0 })
  const playerMusicInfo = usePlayerMusicInfo()
  const playMusicInfo = usePlayMusicInfo()
  const shareType = useSettingValue('common.shareType')
  const downloadFileName = useSettingValue('download.fileName')

  const displayTotal = activeId === 'hot' ? total.hot : total.new
  const totalLabel = formatPlayCount(displayTotal)

  const handleShare = useCallback(() => {
    const currentMusicInfo = playMusicInfo.musicInfo
    if (!currentMusicInfo) return
    const targetMusicInfo = 'progress' in currentMusicInfo ? currentMusicInfo.metadata.musicInfo : currentMusicInfo
    shareMusic(shareType, downloadFileName, targetMusicInfo)
  }, [playMusicInfo.musicInfo, shareType, downloadFileName])

  useEffect(() => {
    if (componentId) {
      setComponentId(COMPONENT_IDS.comment, componentId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleTab = useCallback((id: string) => {
    if (id === 'hot' || id === 'new') setActiveId(id)
  }, [])

  const refreshComment = useCallback(() => {
    if (!playerState.playMusicInfo.musicInfo) return
    let playerMusic = playerState.playMusicInfo.musicInfo
    if ('progress' in playerMusic) playerMusic = playerMusic.metadata.musicInfo

    if (musicInfo && musicInfo.id != playerMusic.id) {
      setMusicInfo(playerMusic)
    } else {
      setInternalRefreshKey(k => k + 1)
    }
  }, [musicInfo])

  const setHotTotal = useCallback((next: number) => {
    setTotal(info => ({ ...info, hot: next }))
  }, [])
  const setNewTotal = useCallback((next: number) => {
    setTotal(info => ({ ...info, new: next }))
  }, [])

  const filterTabs = useMemo(() => ([
    { id: 'hot', label: t('player_comment_hot') },
    { id: 'new', label: t('player_comment_new') },
  ]), [t])

  const commentComponent = useMemo(() => {
    return (
      <View style={styles.innerContainer}>
        <View style={styles.songHead}>
          <Image style={styles.cover} url={playerMusicInfo.pic} />
          <View style={styles.songText}>
            <Text size={magType.rowTitle.size} color={r.ink} numberOfLines={1} style={styles.songName}>
              {musicInfo?.name ?? ''}
            </Text>
            <Text size={magType.meta.size} color={r.muted} numberOfLines={1}>
              {musicInfo?.singer ?? ''}
            </Text>
          </View>
          <TouchableOpacity style={styles.refreshBtn} activeOpacity={0.7} onPress={refreshComment}>
            <Text size={13} color={r.muted} style={styles.refreshText}>{t('comment_refresh')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.countBlock}>
          <Text size={56} color={r.display} style={styles.countNum}>{totalLabel}</Text>
          <Text size={magType.meta.size} color={r.muted} style={styles.countUnit}>{t('player_comment_count_unit')}</Text>
        </View>

        <TextTabs
          items={filterTabs}
          value={activeId}
          onChange={toggleTab}
          style={styles.filterTabs}
        />

        <View collapsable={false} style={[styles.pageStyle, activeId !== 'hot' && styles.hiddenPage]}>
          <HotCommentPage activeId={activeId} musicInfo={musicInfo as LX.Music.MusicInfoOnline} onUpdateTotal={setHotTotal} refreshKey={combinedRefreshKey} />
        </View>
        <View collapsable={false} style={[styles.pageStyle, activeId !== 'new' && styles.hiddenPage]}>
          <NewCommentPage activeId={activeId} musicInfo={musicInfo as LX.Music.MusicInfoOnline} onUpdateTotal={setNewTotal} refreshKey={combinedRefreshKey} />
        </View>
      </View>
    )
  }, [
    activeId,
    combinedRefreshKey,
    filterTabs,
    musicInfo,
    playerMusicInfo.pic,
    r.display,
    r.ink,
    r.muted,
    refreshComment,
    setHotTotal,
    setNewTotal,
    styles,
    t,
    toggleTab,
    totalLabel,
  ])

  const content = musicInfo == null
    ? null
    : <>
        {!hideChrome
          ? <Header embedded={embedded} onBack={onBack} onShare={handleShare} />
          : null}
        {
          musicInfo.source == 'local'
            ? (
            <View style={styles.emptyContainer}>
              <Text color={r.muted}>{t('comment_not support')}</Text>
            </View>
              )
            : commentComponent
        }
    </>

  if (embedded) {
    return (
      <View style={[styles.container, { backgroundColor: r.paper }]}>
        {content}
      </View>
    )
  }

  return (
    <PageContent>
      {content}
    </PageContent>
  )
})

const useLuxStyles = sharedLuxStyles(() => createStyle({
  container: {
    flex: 1,
  },
  innerContainer: {
    flex: 1,
    paddingHorizontal: PAGE_GUTTER,
  },
  songHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 10,
    marginBottom: 18,
  },
  cover: {
    width: 48,
    height: 48,
    borderRadius: 4,
  },
  songText: {
    flex: 1,
    minWidth: 0,
  },
  songName: {
    fontWeight: '700',
    marginBottom: 2,
  },
  refreshBtn: {
    minWidth: PLAYER_ICON_TAP,
    minHeight: PLAYER_ICON_TAP,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  refreshText: {
    fontWeight: '600',
  },
  countBlock: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 14,
  },
  countNum: {
    fontWeight: '800',
    letterSpacing: -2,
  },
  countUnit: {
    fontWeight: '600',
  },
  filterTabs: {
    marginBottom: 6,
  },
  pageStyle: {
    flex: 1,
    overflow: 'hidden',
  },
  hiddenPage: {
    display: 'none',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
}))
