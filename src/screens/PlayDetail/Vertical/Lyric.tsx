import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FlatList, TouchableOpacity, View, type FlatListProps } from 'react-native'
import { pop } from '@/navigation'
import commonState from '@/store/common/state'
import { useStatusbarHeight } from '@/store/common/hook'
import { useIsPlay, usePlayMusicInfo, usePlayerMusicInfo, useProgress } from '@/store/player/hook'
import { useLrcPlay, useLrcSet } from '@/plugins/lyric'
import { createStyle, shareMusic } from '@/utils/tools'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import Image from '@/components/common/Image'
import { collectMusic, playNext, playPrev, togglePlay, uncollectMusic } from '@/core/player/player'
import { createLinearGradientColors, createWhiteFadeMaskColors, getCoverTheme } from './coverTheme'
import SeekBar from './components/SeekBar'
import { useSettingValue } from '@/store/setting/hook'
import { LIST_IDS } from '@/config/constant'
import { getListMusics } from '@/core/list'

const PLAY_BUTTON_COLOR = '#111827'
const sourceAccentColorMap: Record<string, string> = {
  tx: '#31c27c',
  wy: '#d81e06',
  kg: '#2f88ff',
  kw: '#f59e0b',
  mg: '#e11d8d',
  local: '#475569',
  bd: '#111827',
}
const getMusicSource = (musicInfo: LX.Player.PlayMusicInfo['musicInfo'] | null | undefined) => {
  if (!musicInfo) return null
  if ('progress' in musicInfo) return musicInfo.metadata.musicInfo.source
  return musicInfo.source
}
const getSourceAccentColor = (source: string | null | undefined) => {
  if (!source) return '#111827'
  return sourceAccentColorMap[source.toLowerCase()] ?? '#111827'
}
const getSourceTrackColor = (color: string) => {
  if (/^#[0-9a-f]{6}$/i.test(color)) return `${color}33`
  return 'rgba(15,23,42,0.1)'
}

const defaultLines = [
  'Waiting in a car',
  'Waiting for a ride in the dark',
  'At night the city grows',
  'Look at the horizon line',
  'The morning star is on its way',
  'Waiting for the break of day',
  'The city is my church',
  'It wraps me in its sparkling light',
]

export default ({ active }: { active: boolean }) => {
  const statusBarHeight = useStatusbarHeight()
  const musicInfo = usePlayerMusicInfo()
  const playMusicInfo = usePlayMusicInfo()
  const shareType = useSettingValue('common.shareType')
  const downloadFileName = useSettingValue('download.fileName')
  const isPlay = useIsPlay()
  const { line } = useLrcPlay(active)
  const { progress, maxPlayTime } = useProgress(active)
  const lyricLines = useLrcSet()
  const listRef = useRef<FlatList<string>>(null)
  const loveCheckId = useRef(0)
  const coverTheme = useMemo(() => getCoverTheme(musicInfo?.pic ?? `${musicInfo?.id ?? 'track'}`), [musicInfo?.id, musicInfo?.pic])
  const sourceAccentColor = useMemo(() => {
    return getSourceAccentColor(getMusicSource(playMusicInfo.musicInfo))
  }, [playMusicInfo.musicInfo])
  const sourceTrackColor = useMemo(() => getSourceTrackColor(sourceAccentColor), [sourceAccentColor])
  const [isLoved, setIsLoved] = useState(false)
  const hasBackgroundCover = Boolean(musicInfo?.pic)
  const gradientColors = useMemo(() => {
    return hasBackgroundCover
      ? createWhiteFadeMaskColors(84, 0.12, 1)
      : createLinearGradientColors(coverTheme, 84)
  }, [coverTheme, hasBackgroundCover])

  const lines = useMemo(() => {
    if (!lyricLines.length) return defaultLines
    const textLines = lyricLines.map(item => item.text).filter(Boolean)
    return textLines.length ? textLines : defaultLines
  }, [lyricLines])

  useEffect(() => {
    if (!active || line < 0 || line >= lines.length) return
    try {
      listRef.current?.scrollToIndex({ index: line, viewPosition: 0.42, animated: true })
    } catch {}
  }, [active, line, lines.length])

  const handleGoBack = () => {
    void pop(commonState.componentIds.playDetail!)
  }
  const handleShare = () => {
    const currentMusicInfo = playMusicInfo.musicInfo
    if (!currentMusicInfo) return
    const targetMusicInfo = 'progress' in currentMusicInfo ? currentMusicInfo.metadata.musicInfo : currentMusicInfo
    shareMusic(shareType, downloadFileName, targetMusicInfo)
  }
  const refreshLovedState = useCallback(async(targetId?: string | null) => {
    const musicId = targetId ?? musicInfo.id
    if (!musicId) {
      setIsLoved(false)
      return
    }
    const currentCheckId = ++loveCheckId.current
    const loveList = await getListMusics(LIST_IDS.LOVE)
    if (currentCheckId != loveCheckId.current) return
    const targetMusicId = String(musicId)
    setIsLoved(loveList.some(song => String(song.id) == targetMusicId))
  }, [musicInfo.id])

  useEffect(() => {
    void refreshLovedState(musicInfo.id)
  }, [musicInfo.id, refreshLovedState])

  useEffect(() => {
    const handleLoveListChanged = (ids: string[]) => {
      if (!ids.includes(LIST_IDS.LOVE)) return
      void refreshLovedState()
    }
    global.app_event.on('myListMusicUpdate', handleLoveListChanged)
    return () => {
      global.app_event.off('myListMusicUpdate', handleLoveListChanged)
    }
  }, [refreshLovedState])

  const handleToggleLoved = () => {
    if (!musicInfo.id) return
    const nextLoved = !isLoved
    setIsLoved(nextLoved)
    if (nextLoved) collectMusic()
    else uncollectMusic()
  }
  const handleToggleQueuePanel = () => {
    global.app_event.togglePlayQueuePanel()
  }

  const renderItem: FlatListProps<string>['renderItem'] = ({ item, index }) => {
    const activeLine = index === line
    return (
      <View style={styles.lineWrap}>
        <Text
          size={activeLine ? 34 : 28}
          color={activeLine ? sourceAccentColor : 'rgba(15,23,42,0.35)'}
          style={activeLine ? styles.activeLineText : styles.lineText}
        >
          {item}
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View pointerEvents="none" style={styles.gradientLinearWrap}>
        {hasBackgroundCover
          ? <Image url={musicInfo.pic} cache={false} style={styles.gradientCoverImage} blurRadius={46} showFallback={false} />
          : null}
        {gradientColors.map((color, index) => (
          <View key={`lyric_gradient_${index}`} style={[styles.gradientLinearRow, { backgroundColor: color }]} />
        ))}
      </View>
      <View style={[styles.header, { paddingTop: statusBarHeight + 8 }]}>
        <TouchableOpacity style={styles.headerBtn} activeOpacity={0.8} onPress={handleGoBack}>
          <Icon name="chevron-left" rawSize={24} color="#0f172a" style={styles.backIcon} />
        </TouchableOpacity>
        <View style={styles.headerCenter} />
        <TouchableOpacity style={styles.headerBtn} activeOpacity={0.8} onPress={handleShare}>
          <Icon name="share" rawSize={20} color="#0f172a" />
        </TouchableOpacity>
      </View>

      <FlatList
        ref={listRef}
        data={lines}
        renderItem={renderItem}
        keyExtractor={(item, index) => `${index}_${item}`}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onScrollToIndexFailed={() => {}}
      />

      <View style={styles.bottomPanel}>
        <View style={styles.progressWrap}>
          <SeekBar
            progress={progress}
            duration={maxPlayTime}
            accentColor={sourceAccentColor}
            trackColor={sourceTrackColor}
            barHeight={6}
          />
        </View>

        <View style={styles.playerRow}>
          <View style={styles.playerLeft}>
            <Image style={styles.cover} url={musicInfo.pic} />
            <View style={styles.playerText}>
              <Text size={13} color="#111827" numberOfLines={1} style={styles.playerTitle}>
                {musicInfo.name || 'Midnight City'}
              </Text>
              <Text size={11} color="#6b7280" numberOfLines={1}>{musicInfo.singer || 'M83'}</Text>
            </View>
          </View>

          <View style={styles.controls}>
            <TouchableOpacity style={styles.controlBtn} activeOpacity={0.8} onPress={handleToggleLoved}>
              {isLoved
                ? <Text size={20} color="#ef4444" style={styles.loveFilled}>{'\u2665'}</Text>
                : <Icon name="love" rawSize={18} color="#6b7280" />}
            </TouchableOpacity>
            <TouchableOpacity style={styles.controlBtn} activeOpacity={0.8} onPress={() => { void playPrev() }}>
              <Icon name="prevMusic" rawSize={20} color="#111827" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.playBtn} activeOpacity={0.85} onPress={togglePlay}>
              <Icon name={isPlay ? 'pause' : 'play'} rawSize={24} color="#ffffff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.controlBtn} activeOpacity={0.8} onPress={() => { void playNext() }}>
              <Icon name="nextMusic" rawSize={20} color="#111827" />
            </TouchableOpacity>
          </View>

          <View style={styles.rightActions}>
            <TouchableOpacity style={styles.smallIconBtn} activeOpacity={0.8} onPress={handleToggleQueuePanel}>
              <Icon name="menu" rawSize={18} color="#6b7280" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

    </View>
  )
}

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
    height: '62%',
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
    opacity: 0.92,
    transform: [{ scale: 1.1 }],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    transform: [{ rotate: '-90deg' }],
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerUpper: {
    textTransform: 'uppercase',
    fontWeight: '600',
    letterSpacing: 1.3,
  },
  headerTitle: {
    marginTop: 2,
    fontWeight: '500',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 24,
  },
  lineWrap: {
    marginBottom: 18,
  },
  lineText: {
    fontWeight: '700',
    lineHeight: 42,
  },
  activeLineText: {
    fontWeight: '700',
    lineHeight: 52,
  },
  bottomPanel: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(15,23,42,0.04)',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 18,
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
  },
  progressWrap: {
    marginBottom: 12,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  cover: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  playerText: {
    flex: 1,
    minWidth: 0,
    marginLeft: 10,
  },
  playerTitle: {
    fontWeight: '600',
    marginBottom: 2,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 6,
  },
  controlBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: PLAY_BUTTON_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 3,
    shadowColor: PLAY_BUTTON_COLOR,
    shadowOpacity: 0.16,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  smallIconBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  loveFilled: {
    fontWeight: '700',
    lineHeight: 24,
  },
})
