import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Easing, TouchableOpacity, View } from 'react-native'
import { pop } from '@/navigation'
import { useStatusbarHeight } from '@/store/common/hook'
import { useIsPlay, usePlayMusicInfo, usePlayerMusicInfo, useProgress } from '@/store/player/hook'
import { createStyle, shareMusic } from '@/utils/tools'
import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import { collectMusic, playNext, playPrev, togglePlay, uncollectMusic } from '@/core/player/player'
import { useWindowSize } from '@/utils/hooks'
import { createLinearGradientColors, createWhiteFadeMaskColors, getCoverTheme } from './coverTheme'
import { LIST_IDS } from '@/config/constant'
import { getListMusics } from '@/core/list'
import SeekBar from './components/SeekBar'
import { useSettingValue } from '@/store/setting/hook'

const PLAY_BUTTON_COLOR = '#111827'
const TONEARM_OUT_ANGLE = '18deg'
const TONEARM_IN_ANGLE = '-2deg'
const TONEARM_PIVOT_X = 111
const TONEARM_PIVOT_Y = 9
const RECORD_SPIN_DURATION = 30000
const COVER_TRANSITION_DURATION = 280

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
  return '#e5e7eb'
}

export default ({ componentId, active }: { componentId: string, active: boolean }) => {
  const statusBarHeight = useStatusbarHeight()
  const musicInfo = usePlayerMusicInfo()
  const playMusicInfo = usePlayMusicInfo()
  const { nowPlayTimeStr, maxPlayTimeStr, progress, maxPlayTime } = useProgress(active)
  const shareType = useSettingValue('common.shareType')
  const downloadFileName = useSettingValue('download.fileName')
  const isPlay = useIsPlay()
  const tonearmProgress = useRef(new Animated.Value(isPlay ? 1 : 0)).current
  const recordSpinProgress = useRef(new Animated.Value(0)).current
  const recordSpinAnim = useRef<Animated.CompositeAnimation | null>(null)
  const coverTransition = useRef(new Animated.Value(1)).current
  const loveCheckId = useRef(0)
  const hasMountedRef = useRef(false)
  const [currentCover, setCurrentCover] = useState(musicInfo.pic)
  const [prevCover, setPrevCover] = useState<string | null | undefined>(null)
  const [isLoved, setIsLoved] = useState(false)
  const winSize = useWindowSize()
  const discSize = Math.min(winSize.width * 0.9, 450)
  const coverTheme = useMemo(() => getCoverTheme(musicInfo?.pic ?? `${musicInfo?.id ?? 'track'}`), [musicInfo?.id, musicInfo?.pic])
  const sourceAccentColor = useMemo(() => {
    return getSourceAccentColor(getMusicSource(playMusicInfo.musicInfo))
  }, [playMusicInfo.musicInfo])
  const sourceTrackColor = useMemo(() => getSourceTrackColor(sourceAccentColor), [sourceAccentColor])
  const hasBackgroundCover = Boolean(musicInfo?.pic)
  const gradientColors = useMemo(() => {
    return hasBackgroundCover
      ? createWhiteFadeMaskColors(84, 0.12, 1)
      : createLinearGradientColors(coverTheme, 84)
  }, [coverTheme, hasBackgroundCover])
  const radialCenterX = discSize * 0.5
  const radialCenterY = discSize * 0.28
  const radialMaxRadius = discSize * 0.74
  const radialLayersPrimary = useMemo(() => {
    const count = 20
    return Array.from({ length: count }, (_, index) => {
      const t = index / (count - 1) // outer -> inner
      const radius = radialMaxRadius * (1 - t * 0.8)
      const size = radius * 2
      const alpha = 0.004 + Math.pow(t, 1.7) * 0.012
      return {
        key: `radial_primary_${index}`,
        size,
        opacity: alpha,
        color: coverTheme.top,
      }
    })
  }, [coverTheme.top, radialMaxRadius])
  const radialLayersSecondary = useMemo(() => {
    const count = 10
    return Array.from({ length: count }, (_, index) => {
      const t = index / (count - 1) // outer -> inner
      const radius = radialMaxRadius * (0.82 - t * 0.64)
      const size = radius * 2
      const alpha = 0.002 + Math.pow(t, 1.8) * 0.008
      return {
        key: `radial_secondary_${index}`,
        size,
        opacity: alpha,
        color: coverTheme.glow,
      }
    })
  }, [coverTheme.glow, radialMaxRadius])
  const radialLayersHighlight = useMemo(() => {
    const count = 6
    return Array.from({ length: count }, (_, index) => {
      const t = index / (count - 1) // outer -> inner
      const radius = radialMaxRadius * (0.5 - t * 0.45)
      const size = radius * 2
      const alpha = 0.0008 + Math.pow(t, 2.2) * 0.0028
      return {
        key: `radial_highlight_${index}`,
        size,
        opacity: alpha,
        color: coverTheme.middle,
      }
    })
  }, [coverTheme.middle, radialMaxRadius])
  const vinylGrooves = useMemo(() => {
    const grooves: Array<{ key: string, inset: number, opacity: number }> = []
    const start = Math.max(10, discSize * 0.06)
    const end = discSize * 0.31
    const step = Math.max(2, discSize * 0.017)
    let index = 0
    for (let inset = start; inset < end; inset += step) {
      grooves.push({
        key: `vinyl_groove_${index++}`,
        inset,
        opacity: index % 2 ? 0.085 : 0.052,
      })
    }
    return grooves
  }, [discSize])
  const recordRotate = recordSpinProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })
  const vinylSheenStyle = useMemo(() => ({
    top: discSize * 0.12,
    left: discSize * 0.18,
    width: discSize * 0.58,
    height: discSize * 0.42,
    borderRadius: discSize * 0.29,
  }), [discSize])

  const goBack = () => {
    void pop(componentId)
  }
  const refreshLovedState = useCallback(async(targetId?: string | null) => {
    const musicId = targetId ?? musicInfo.id
    if (!musicId) {
      setIsLoved(false)
      return
    }
    const currentCheckId = ++loveCheckId.current
    const loveList = await getListMusics(LIST_IDS.LOVE)
    if (currentCheckId !== loveCheckId.current) return
    setIsLoved(loveList.some(song => song.id === musicId))
  }, [musicInfo.id])
  const animateTonearm = useCallback((isIn: boolean) => {
    Animated.timing(tonearmProgress, {
      toValue: isIn ? 1 : 0,
      duration: isIn ? 280 : 220,
      easing: isIn ? Easing.out(Easing.cubic) : Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [tonearmProgress])
  const tonearmRotate = tonearmProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [TONEARM_OUT_ANGLE, TONEARM_IN_ANGLE],
  })
  const currentCoverOpacity = coverTransition
  const currentCoverScale = coverTransition.interpolate({
    inputRange: [0, 1],
    outputRange: [0.94, 1],
  })
  const prevCoverOpacity = coverTransition.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  })
  const prevCoverScale = coverTransition.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.05],
  })

  const startRecordSpin = useCallback(() => {
    const startLinearLoop = () => {
      const loop = Animated.loop(
        Animated.timing(recordSpinProgress, {
          toValue: 1,
          duration: RECORD_SPIN_DURATION,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      )
      recordSpinAnim.current = loop
      loop.start()
    }

    recordSpinAnim.current?.stop()
    recordSpinProgress.stopAnimation(current => {
      const from = ((current % 1) + 1) % 1
      const remainingDuration = Math.max(32, Math.round(RECORD_SPIN_DURATION * (1 - from)))
      if (from <= 0.0001) {
        recordSpinProgress.setValue(0)
        startLinearLoop()
        return
      }
      const continueCurrentTurn = Animated.timing(recordSpinProgress, {
        toValue: 1,
        duration: remainingDuration,
        easing: Easing.linear,
        useNativeDriver: true,
      })
      recordSpinAnim.current = continueCurrentTurn
      continueCurrentTurn.start(({ finished }) => {
        if (!finished) return
        recordSpinProgress.setValue(0)
        startLinearLoop()
      })
    })
  }, [recordSpinProgress])

  const stopRecordSpin = useCallback(() => {
    recordSpinAnim.current?.stop()
    recordSpinAnim.current = null
    recordSpinProgress.stopAnimation(current => {
      recordSpinProgress.setValue(current % 1)
    })
  }, [recordSpinProgress])

  useEffect(() => {
    animateTonearm(isPlay)
  }, [animateTonearm, isPlay])

  useEffect(() => {
    if (isPlay && active) startRecordSpin()
    else stopRecordSpin()
    return () => {
      stopRecordSpin()
    }
  }, [active, isPlay, startRecordSpin, stopRecordSpin])

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true
      setCurrentCover(musicInfo.pic)
      return
    }
    if (musicInfo.pic === currentCover) return

    setPrevCover(currentCover)
    setCurrentCover(musicInfo.pic)
    coverTransition.setValue(0)
    Animated.timing(coverTransition, {
      toValue: 1,
      duration: COVER_TRANSITION_DURATION,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setPrevCover(null)
    })
  }, [coverTransition, currentCover, musicInfo.id, musicInfo.pic])

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

  const handleTogglePlay = () => {
    animateTonearm(!isPlay)
    togglePlay()
  }
  const handleShare = () => {
    const currentMusicInfo = playMusicInfo.musicInfo
    if (!currentMusicInfo) return
    const targetMusicInfo = 'progress' in currentMusicInfo ? currentMusicInfo.metadata.musicInfo : currentMusicInfo
    shareMusic(shareType, downloadFileName, targetMusicInfo)
  }
  const handleToggleQueuePanel = () => {
    global.app_event.togglePlayQueuePanel()
  }

  return (
    <View style={styles.container}>
      <View pointerEvents="none" style={styles.gradientLinearWrap}>
        {hasBackgroundCover
          ? <Image url={musicInfo.pic} cache={false} style={styles.gradientCoverImage} blurRadius={46} showFallback={false} />
          : null}
        {gradientColors.map((color, index) => (
          <View key={`pic_gradient_${index}`} style={[styles.gradientLinearRow, { backgroundColor: color }]} />
        ))}
      </View>
      <View style={[styles.header, { paddingTop: statusBarHeight + 8 }]}>
        <TouchableOpacity style={styles.headerBtn} activeOpacity={0.7} onPress={goBack}>
          <Icon name="chevron-left" rawSize={24} color="#111827" style={styles.backIcon} />
        </TouchableOpacity>
        <View style={styles.headerCenter} />
        <TouchableOpacity style={styles.headerBtn} activeOpacity={0.7} onPress={handleShare}>
          <Icon name="share" rawSize={20} color="#111827" />
        </TouchableOpacity>
      </View>

      <View style={styles.main}>
        <View style={[styles.recordWrap, { width: discSize, height: discSize }]}>
          {radialLayersPrimary.map(layer => (
            <View
              key={layer.key}
              pointerEvents="none"
              style={[
                styles.radialLayer,
                {
                  width: layer.size,
                  height: layer.size,
                  borderRadius: layer.size / 2,
                  left: radialCenterX - layer.size / 2,
                  top: radialCenterY - layer.size / 2,
                  backgroundColor: layer.color,
                  opacity: layer.opacity,
                },
              ]}
            />
          ))}
          {radialLayersSecondary.map(layer => (
            <View
              key={layer.key}
              pointerEvents="none"
              style={[
                styles.radialLayer,
                {
                  width: layer.size,
                  height: layer.size,
                  borderRadius: layer.size / 2,
                  left: radialCenterX - layer.size / 2,
                  top: radialCenterY - layer.size / 2,
                  backgroundColor: layer.color,
                  opacity: layer.opacity,
                },
              ]}
            />
          ))}
          {radialLayersHighlight.map(layer => (
            <View
              key={layer.key}
              pointerEvents="none"
              style={[
                styles.radialLayer,
                {
                  width: layer.size,
                  height: layer.size,
                  borderRadius: layer.size / 2,
                  left: radialCenterX - layer.size / 2,
                  top: radialCenterY - layer.size / 2,
                  backgroundColor: layer.color,
                  opacity: layer.opacity,
                },
              ]}
            />
          ))}
          <Animated.View style={[styles.recordSpin, { transform: [{ rotate: recordRotate }] }]}>
            <View style={styles.record}>
              {vinylGrooves.map(groove => (
                <View
                  key={groove.key}
                  pointerEvents="none"
                  style={[
                    styles.vinylGroove,
                    {
                      top: groove.inset,
                      left: groove.inset,
                      right: groove.inset,
                      bottom: groove.inset,
                      opacity: groove.opacity,
                    },
                  ]}
                />
              ))}
              <View pointerEvents="none" style={[styles.vinylSheen, vinylSheenStyle]} />
              <View style={styles.recordInner}>
                {prevCover ? (
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.coverLayer,
                      { opacity: prevCoverOpacity, transform: [{ scale: prevCoverScale }] },
                    ]}
                  >
                    <Image style={styles.recordImage} url={prevCover} />
                  </Animated.View>
                ) : null}
                <Animated.View style={[styles.coverLayer, { opacity: currentCoverOpacity, transform: [{ scale: currentCoverScale }] }]}>
                  <Image style={styles.recordImage} url={currentCover} />
                </Animated.View>
              </View>
            </View>
          </Animated.View>
          <View pointerEvents="none" style={styles.tonearm}>
            <Animated.View
              style={[
                styles.tonearmMotion,
                {
                  transform: [
                    { translateX: TONEARM_PIVOT_X },
                    { translateY: TONEARM_PIVOT_Y },
                    { rotate: tonearmRotate },
                    { translateX: -TONEARM_PIVOT_X },
                    { translateY: -TONEARM_PIVOT_Y },
                  ],
                },
              ]}
            >
              <View style={styles.tonearmPivot} />
              <View style={styles.tonearmArm} />
              <View style={styles.tonearmHead} />
            </Animated.View>
          </View>
        </View>
      </View>

      <View style={styles.bottomPanel}>
        <View style={styles.songInfo}>
          <View style={styles.titleRow}>
            <TouchableOpacity style={styles.sideActionBtn} activeOpacity={0.7}>
              <Icon name="comment" rawSize={20} color="#9ca3af" />
            </TouchableOpacity>
            <Text size={24} color="#111827" numberOfLines={1} style={styles.songTitle}>
              {musicInfo.name || 'Midnight City Echoes'}
            </Text>
            <TouchableOpacity style={styles.sideActionBtn} activeOpacity={0.7} onPress={handleToggleLoved}>
              {isLoved
                ? <Text size={20} color="#ef4444" style={styles.loveFilled}>{'\u2665'}</Text>
                : <Icon name="love" rawSize={20} color="#9ca3af" />}
            </TouchableOpacity>
          </View>
          <Text size={18} color={sourceAccentColor} numberOfLines={1} style={styles.singer}>
            {musicInfo.singer || 'Neon Dreamer'}
          </Text>
          <View>
            <View style={styles.progressWrap}>
              <SeekBar
                progress={progress}
                duration={maxPlayTime}
                accentColor={sourceAccentColor}
                trackColor={sourceTrackColor}
                barHeight={4}
              />
            </View>
            <View style={styles.timeRow}>
              <Text size={11} color="#9ca3af" style={styles.timeText}>{nowPlayTimeStr}</Text>
              <Text size={11} color="#9ca3af" style={styles.timeText}>{maxPlayTimeStr}</Text>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.smallBtn} activeOpacity={0.8}>
            <Icon name="list-loop" rawSize={22} color="#9ca3af" />
          </TouchableOpacity>
          <View style={styles.controlRow}>
            <TouchableOpacity style={styles.mediumBtn} activeOpacity={0.8} onPress={() => { void playPrev() }}>
              <Icon name="prevMusic" rawSize={28} color="#374151" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.playBtn} activeOpacity={0.85} onPress={handleTogglePlay}>
              <Icon name={isPlay ? 'pause' : 'play'} rawSize={34} color="#ffffff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.mediumBtn} activeOpacity={0.8} onPress={() => { void playNext() }}>
              <Icon name="nextMusic" rawSize={28} color="#374151" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.smallBtn} activeOpacity={0.8} onPress={handleToggleQueuePanel}>
            <Icon name="menu" rawSize={22} color="#9ca3af" />
          </TouchableOpacity>
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
  radialLayer: {
    position: 'absolute',
  },
  header: {
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
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
  main: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingTop: 6,
  },
  recordWrap: {
    position: 'relative',
    overflow: 'visible',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  tonearm: {
    position: 'absolute',
    top: 36,
    right: 2,
    width: 118,
    height: 76,
    opacity: 0.66,
    zIndex: 5,
  },
  tonearmMotion: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  tonearmPivot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#a7afbe',
  },
  tonearmArm: {
    position: 'absolute',
    top: 6,
    right: 12,
    width: 82,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#b8bfcc',
  },
  tonearmHead: {
    position: 'absolute',
    top: 5,
    right: 92,
    width: 14,
    height: 12,
    borderRadius: 3,
    backgroundColor: '#7f8898',
  },
  recordSpin: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  record: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    borderWidth: 3,
    borderColor: 'rgba(15,23,42,0.08)',
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  vinylGroove: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  vinylSheen: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    transform: [{ rotate: '-18deg' }],
    opacity: 0.35,
  },
  recordInner: {
    width: '66%',
    height: '66%',
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  recordImage: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
  },
  songInfo: {
    width: '100%',
    maxWidth: 420,
  },
  bottomPanel: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 22,
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 42,
    marginBottom: 4,
  },
  sideActionBtn: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loveFilled: {
    lineHeight: 24,
    fontWeight: '700',
  },
  songTitle: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '700',
    marginHorizontal: 4,
  },
  singer: {
    textAlign: 'center',
    fontWeight: '400',
    marginBottom: 12,
  },
  progressWrap: {
    marginTop: 4,
  },
  timeRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    fontWeight: '700',
  },
  footer: {
    paddingTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  smallBtn: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mediumBtn: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: PLAY_BUTTON_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 10,
    shadowColor: PLAY_BUTTON_COLOR,
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
})

