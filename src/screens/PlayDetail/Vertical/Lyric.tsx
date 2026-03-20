import { useEffect, useMemo, useRef, useState } from 'react'
import { FlatList, TouchableOpacity, View, type FlatListProps } from 'react-native'
import { pop } from '@/navigation'
import commonState from '@/store/common/state'
import { useStatusbarHeight } from '@/store/common/hook'
import { useIsPlay, usePlayerMusicInfo, useProgress } from '@/store/player/hook'
import { useLrcPlay, useLrcSet } from '@/plugins/lyric'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import Image from '@/components/common/Image'
import { playNext, playPrev, togglePlay } from '@/core/player/player'
import { createLinearGradientColors, createWhiteFadeMaskColors, getCoverAccentColor, getCoverTheme } from './coverTheme'

const PLAY_BUTTON_COLOR = '#111827'

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

const toPercent = (now: number, total: number): `${number}%` => {
  if (!total) return '0%'
  return `${Math.min(100, Math.max(0, Math.floor((now / total) * 100)))}%`
}

export default ({ active }: { active: boolean }) => {
  const statusBarHeight = useStatusbarHeight()
  const musicInfo = usePlayerMusicInfo()
  const isPlay = useIsPlay()
  const { line } = useLrcPlay(active)
  const { progress, maxPlayTime } = useProgress(active)
  const lyricLines = useLrcSet()
  const listRef = useRef<FlatList<string>>(null)
  const accentRequestId = useRef(0)
  const coverTheme = useMemo(() => getCoverTheme(musicInfo?.pic ?? `${musicInfo?.id ?? 'track'}`), [musicInfo?.id, musicInfo?.pic])
  const [accentColor, setAccentColor] = useState(coverTheme.accent)
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

  useEffect(() => {
    const requestId = ++accentRequestId.current
    const fallbackAccent = coverTheme.accent
    setAccentColor(fallbackAccent)
    if (!musicInfo?.pic) return

    void getCoverAccentColor(musicInfo.pic).then(color => {
      if (requestId !== accentRequestId.current) return
      if (!color) return
      setAccentColor(color)
    })
  }, [coverTheme.accent, musicInfo?.id, musicInfo?.pic])

  const handleGoBack = () => {
    void pop(commonState.componentIds.playDetail!)
  }

  const renderItem: FlatListProps<string>['renderItem'] = ({ item, index }) => {
    const activeLine = index === line
    return (
      <View style={styles.lineWrap}>
        <Text
          size={activeLine ? 34 : 28}
          color={activeLine ? accentColor : 'rgba(15,23,42,0.35)'}
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
          ? <Image url={musicInfo.pic} style={styles.gradientCoverImage} blurRadius={46} showFallback={false} />
          : null}
        {gradientColors.map((color, index) => (
          <View key={`lyric_gradient_${index}`} style={[styles.gradientLinearRow, { backgroundColor: color }]} />
        ))}
      </View>
      <View style={[styles.header, { paddingTop: statusBarHeight + 8 }]}>
        <TouchableOpacity style={styles.headerBtn} activeOpacity={0.8} onPress={handleGoBack}>
          <Icon name="chevron-left" rawSize={24} color="#0f172a" />
        </TouchableOpacity>
        <View style={styles.headerCenter} />
        <TouchableOpacity style={styles.headerBtn} activeOpacity={0.8}>
          <Icon name="menu" rawSize={22} color="#0f172a" />
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
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: toPercent(progress, maxPlayTime), backgroundColor: accentColor }]} />
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
            <TouchableOpacity style={styles.smallIconBtn} activeOpacity={0.8}>
              <Icon name="share" rawSize={18} color="#6b7280" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.smallIconBtn} activeOpacity={0.8}>
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
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(15,23,42,0.1)',
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
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
})
