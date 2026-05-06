import { memo, useMemo, useEffect, useRef, useState, useCallback } from 'react'
import { View, TouchableOpacity, Image as RNImage } from 'react-native'
import Header from './components/Header'
import Image from '@/components/common/Image'
import CommentHot from './CommentHot'
import CommentNew from './CommentNew'
import { createStyle, shareMusic } from '@/utils/tools'
import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { COMPONENT_IDS } from '@/config/constant'
import { setComponentId } from '@/core/common'
import PageContent from '@/components/PageContent'
import playerState from '@/store/player/state'
import { usePlayerMusicInfo, usePlayMusicInfo } from '@/store/player/hook'
import { useSettingValue } from '@/store/setting/hook'
import { createLinearGradientColors, createWhiteFadeMaskColors, getCoverTheme } from '../PlayDetail/Vertical/coverTheme'
import fireIcon from '../../../assets/img/fire.png'
import latestIcon from '../../../assets/img/latest.png'
import updateCommentIcon from '../../../assets/img/update-comment.png'

type ActiveId = 'hot' | 'new'

const TabIconBtn = ({ icon, isActive, onPress }: {
  icon: number
  isActive: boolean
  onPress: () => void
}) => {
  return (
    <TouchableOpacity
      style={[styles.tabIconBtn, isActive && styles.tabIconBtnActive]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <RNImage source={icon} style={styles.tabIconBlack} />
    </TouchableOpacity>
  )
}

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
export default memo(({ componentId, embedded, onBack, refreshKey = 0 }: {
  componentId?: string
  embedded?: boolean
  onBack?: () => void
  refreshKey?: number
}) => {
  const [activeId, setActiveId] = useState<ActiveId>('hot')
  const [musicInfo, setMusicInfo] = useState<LX.Music.MusicInfo | null>(getMusicInfo(playerState.playMusicInfo.musicInfo))
  const [internalRefreshKey, setInternalRefreshKey] = useState(0)
  const combinedRefreshKey = refreshKey + internalRefreshKey
  const t = useI18n()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [total, setTotal] = useState({ hot: 0, new: 0 })
  const playerMusicInfo = usePlayerMusicInfo()
  const playMusicInfo = usePlayMusicInfo()
  const coverPic = playerMusicInfo.pic

  const coverTheme = useMemo(() => getCoverTheme(coverPic ?? `${playerMusicInfo.id ?? 'track'}`), [playerMusicInfo.id, coverPic])
  const hasBackgroundCover = Boolean(coverPic)
  const gradientColors = useMemo(() => {
    return hasBackgroundCover
      ? createWhiteFadeMaskColors(84, 0.12, 1)
      : createLinearGradientColors(coverTheme, 84)
  }, [coverTheme, hasBackgroundCover])
  const shareType = useSettingValue('common.shareType')
  const downloadFileName = useSettingValue('download.fileName')

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

  const toggleTab = useCallback((id: ActiveId) => {
    setActiveId(id)
  }, [])

  const refreshComment = useCallback(() => {
    if (!playerState.playMusicInfo.musicInfo) return
    let playerMusicInfo = playerState.playMusicInfo.musicInfo
    if ('progress' in playerMusicInfo) playerMusicInfo = playerMusicInfo.metadata.musicInfo

    if (musicInfo && musicInfo.id != playerMusicInfo.id) {
      setMusicInfo(playerMusicInfo)
    } else {
      setInternalRefreshKey(k => k + 1)
    }
  }, [musicInfo])

  const setHotTotal = useCallback((total: number) => {
    setTotal(totalInfo => ({ ...totalInfo, hot: total }))
  }, [])
  const setNewTotal = useCallback((total: number) => {
    setTotal(totalInfo => ({ ...totalInfo, new: total }))
  }, [])

  const commentComponent = useMemo(() => {
    return (
      <View style={styles.innerContainer}>
        <View style={styles.infoRow}>
          <View style={styles.songInfo}>
            <Text size={15} color="#111827" numberOfLines={2} style={styles.songName}>
              {musicInfo?.name ?? ''}
            </Text>
            <Text size={11} color="#64748b" numberOfLines={1}>
              {musicInfo?.singer ?? ''}
            </Text>
          </View>
          <View style={styles.tabIcons}>
            <TabIconBtn icon={latestIcon} isActive={activeId === 'new'} onPress={() => { toggleTab('new') }} />
            <TabIconBtn icon={fireIcon} isActive={activeId === 'hot'} onPress={() => { toggleTab('hot') }} />
            <TabIconBtn icon={updateCommentIcon} isActive={false} onPress={refreshComment} />
          </View>
        </View>
        <View collapsable={false} style={[styles.pageStyle, activeId !== 'hot' && styles.hiddenPage]}>
          <HotCommentPage activeId={activeId} musicInfo={musicInfo as LX.Music.MusicInfoOnline} onUpdateTotal={setHotTotal} refreshKey={combinedRefreshKey} />
        </View>
        <View collapsable={false} style={[styles.pageStyle, activeId !== 'new' && styles.hiddenPage]}>
          <NewCommentPage activeId={activeId} musicInfo={musicInfo as LX.Music.MusicInfoOnline} onUpdateTotal={setNewTotal} refreshKey={combinedRefreshKey} />
        </View>
      </View>
    )
  }, [activeId, musicInfo, refreshComment, setHotTotal, setNewTotal, toggleTab, combinedRefreshKey])

  const content = musicInfo == null
    ? null
    : <>
        <Header embedded={embedded} onBack={onBack} onShare={handleShare} />
        {
          musicInfo.source == 'local'
            ? (
            <View style={styles.emptyContainer}>
              <Text>{t('comment_not support')}</Text>
            </View>
              )
            : commentComponent
        }
    </>

  if (embedded) {
    return (
      <View style={styles.container}>
        <View pointerEvents="none" style={styles.gradientLinearWrap}>
          {hasBackgroundCover
            ? <Image url={coverPic} cache={false} style={styles.gradientCoverImage} blurRadius={46} showFallback={false} />
            : null}
          {gradientColors.map((color, index) => (
            <View key={`comment_gradient_${index}`} style={[styles.gradientLinearRow, { backgroundColor: color }]} />
          ))}
        </View>
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

const styles = createStyle({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  gradientLinearWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '42%',
    overflow: 'hidden',
  },
  gradientLinearRow: {
    flex: 1,
  },
  gradientCoverImage: {
    position: 'absolute',
    top: -26,
    left: -24,
    right: -24,
    bottom: -18,
    opacity: 0.82,
    transform: [{ scale: 1.1 }],
  },
  innerContainer: {
    flex: 1,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 14,
  },
  songInfo: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },
  songName: {
    fontWeight: '700',
    marginBottom: 2,
  },
  tabIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tabIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconBtnActive: {
    backgroundColor: 'rgba(15,23,42,0.06)',
  },
  tabIconBlack: {
    width: 18,
    height: 18,
    tintColor: '#111827',
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
})
