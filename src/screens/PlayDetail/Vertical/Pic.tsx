/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Easing, ScrollView, TouchableOpacity, View } from 'react-native'
import { MdiIcon } from '@/components/common/MdiIcon'
import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import MusicAddModal, { type MusicAddModalType } from '@/components/MusicAddModal'
import { SourceTag } from '@/components/magazine'
import { Icon } from '@/components/common/Icon'
import { LIST_IDS, MUSIC_TOGGLE_MODE, MUSIC_TOGGLE_MODE_LIST } from '@/config/constant'
import { getListMusics } from '@/core/list'
import { collectMusic, playNext, playPrev, togglePlay, uncollectMusic } from '@/core/player/player'
import { updateSetting } from '@/core/common'
import { useI18n, type Message } from '@/lang'
import { useLrcPlay, useLrcSet } from '@/plugins/lyric'
import { useMyList } from '@/store/list/hook'
import { useIsPlay, usePlayMusicInfo, usePlayerMusicInfo, useProgress } from '@/store/player/hook'
import { useSettingValue } from '@/store/setting/hook'
import { useWindowSize } from '@/utils/hooks'
import { createStyle, toast } from '@/utils/tools'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { PAGE_GUTTER, magType } from '@/theme/magazineType'
import { PlayerTransport, playerTransportControlStyles } from './PlayerTransport'

const TONEARM_OUT_ANGLE = '18deg'
const TONEARM_IN_ANGLE = '-2deg'
const TONEARM_PIVOT_X = 104
const TONEARM_PIVOT_Y = 15
const RECORD_SPIN_DURATION = 30000
const COVER_TRANSITION_DURATION = 280
/** Non-record content above the pinned transport (eyebrow / title / lyrics + min gaps). */
const PLAYER_RESERVED_ABOVE = 38
const PLAYER_RESERVED_TITLE = 90
const PLAYER_RESERVED_LYRIC = 48 + 14
/** Min flex gaps: after record / title / lyric. */
const PLAYER_RESERVED_GAPS = 30 + 18 + 14
const PLAYER_DISC_MIN = 200

const sourceShortKey = (source: string): keyof Message => {
  switch (source) {
    case 'kw': return 'source_short_kw'
    case 'kg': return 'source_short_kg'
    case 'tx': return 'source_short_tx'
    case 'wy': return 'source_short_wy'
    case 'mg': return 'source_short_mg'
    default: return `source_real_${source}` as keyof Message
  }
}

const getMusicSource = (musicInfo: LX.Player.PlayMusicInfo['musicInfo'] | null | undefined) => {
  if (!musicInfo) return null
  if ('progress' in musicInfo) return musicInfo.metadata.musicInfo.source
  return musicInfo.source
}

export default ({ active }: { componentId: string, active: boolean }) => {
  const styles = useLuxStyles()
  const { colors, mode } = useLuxTheme()
  const r = magazineRoles(colors)
  const t = useI18n()
  const musicInfo = usePlayerMusicInfo()
  const playMusicInfo = usePlayMusicInfo()
  const myLists = useMyList()
  const { nowPlayTimeStr, maxPlayTimeStr, progress, maxPlayTime } = useProgress(active)
  const togglePlayMethod = useSettingValue('player.togglePlayMethod')
  const isPlay = useIsPlay()
  const { line } = useLrcPlay(active)
  const lyricLines = useLrcSet()
  const tonearmProgress = useRef(new Animated.Value(isPlay ? 1 : 0)).current
  const recordSpinProgress = useRef(new Animated.Value(0)).current
  const recordSpinAnim = useRef<Animated.CompositeAnimation | null>(null)
  const coverTransition = useRef(new Animated.Value(1)).current
  const loveCheckId = useRef(0)
  const hasMountedRef = useRef(false)
  const musicAddModalRef = useRef<MusicAddModalType>(null)
  const [currentCover, setCurrentCover] = useState(musicInfo.pic)
  const [prevCover, setPrevCover] = useState<string | null | undefined>(null)
  const [isLoved, setIsLoved] = useState(false)
  const [scrollHeight, setScrollHeight] = useState(0)
  const winSize = useWindowSize()

  const currentLyric = lyricLines[line]?.text ?? ''
  const nextLyric = lyricLines[line + 1]?.text ?? ''
  const hasLyricPreview = Boolean(currentLyric || nextLyric)

  const discSize = useMemo(() => {
    const widthBased = winSize.width - PAGE_GUTTER * 2 - 16
    const reservedBelow = PLAYER_RESERVED_TITLE +
      (hasLyricPreview ? PLAYER_RESERVED_LYRIC : 0) +
      PLAYER_RESERVED_GAPS
    const heightBased = scrollHeight > 0
      ? scrollHeight - PLAYER_RESERVED_ABOVE - reservedBelow
      : widthBased
    return Math.max(PLAYER_DISC_MIN, Math.min(widthBased, heightBased))
  }, [hasLyricPreview, scrollHeight, winSize.width])

  const source = getMusicSource(playMusicInfo.musicInfo)
  const sourceLabel = source && source !== 'local' ? t(sourceShortKey(source)) : ''
  const singerMeta = [musicInfo.singer, musicInfo.album].filter(Boolean).join(' · ')

  const fromListName = useMemo(() => {
    const listId = playMusicInfo.listId
    if (!listId) return ''
    if (listId === LIST_IDS.DEFAULT) return t('list_name_default')
    if (listId === LIST_IDS.LOVE) return t('list_name_love')
    if (listId === LIST_IDS.TEMP) return t('list_name_temp')
    return myLists.find(list => list.id === listId)?.name ?? ''
  }, [myLists, playMusicInfo.listId, t])

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

  const armCore = mode === 'dark' ? r.ink : colors.surface.card
  const armEdge = mode === 'dark' ? r.paper : r.ink
  const vinylRing = mode === 'dark' ? r.hairline : colors.scrim.vinylRing

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
    if (nextLoved) void collectMusic()
    else void uncollectMusic()
  }

  const handleTogglePlay = () => {
    animateTonearm(!isPlay)
    togglePlay()
  }

  const handleShowMusicAddModal = () => {
    const current = playMusicInfo.musicInfo
    if (!current) return
    musicAddModalRef.current?.show({
      musicInfo: 'progress' in current ? current.metadata.musicInfo : current,
      listId: '',
      isMove: false,
    })
  }

  const handleToggleQueuePanel = () => {
    global.app_event.togglePlayQueuePanel()
  }

  const handleTogglePlayMode = () => {
    let index = MUSIC_TOGGLE_MODE_LIST.indexOf(togglePlayMethod)
    if (++index >= MUSIC_TOGGLE_MODE_LIST.length) index = 0
    const modeNext = MUSIC_TOGGLE_MODE_LIST[index]
    updateSetting({ 'player.togglePlayMethod': modeNext })
    let modeName: 'play_list_loop' | 'play_list_random' | 'play_list_order' | 'play_single_loop' | 'play_single'
    switch (modeNext) {
      case MUSIC_TOGGLE_MODE.listLoop:
        modeName = 'play_list_loop'
        break
      case MUSIC_TOGGLE_MODE.random:
        modeName = 'play_list_random'
        break
      case MUSIC_TOGGLE_MODE.list:
        modeName = 'play_list_order'
        break
      case MUSIC_TOGGLE_MODE.singleLoop:
        modeName = 'play_single_loop'
        break
      default:
        modeName = 'play_single'
        break
    }
    toast(t(modeName))
  }

  const playModeIcon = useMemo(() => {
    switch (togglePlayMethod) {
      case MUSIC_TOGGLE_MODE.listLoop:
        return 'list-loop'
      case MUSIC_TOGGLE_MODE.random:
        return 'list-random'
      case MUSIC_TOGGLE_MODE.list:
        return 'list-order'
      case MUSIC_TOGGLE_MODE.singleLoop:
        return 'single-loop'
      default:
        return 'single'
    }
  }, [togglePlayMethod])

  return (
    <View style={[styles.container, { backgroundColor: r.paper }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
        onLayout={(event) => {
          const next = event.nativeEvent.layout.height
          if (next > 0 && next !== scrollHeight) setScrollHeight(next)
        }}
      >
        <Text
          size={magType.eyebrow.size}
          color={r.eyebrow}
          style={styles.eyebrow}
          numberOfLines={1}
        >
          {fromListName
            ? t('player_now_playing_from', { name: fromListName })
            : t('player_now_playing')}
        </Text>

        <View style={styles.flexGapSm} />

        <View style={[styles.recordWrap, { width: discSize, height: discSize }]}>
          <Animated.View style={[styles.recordSpin, { transform: [{ rotate: recordRotate }] }]}>
            <View style={[styles.record, {
              backgroundColor: colors.surface.vinyl,
              borderColor: vinylRing,
            }]}>
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
                      borderColor: colors.line.white,
                    },
                  ]}
                />
              ))}
              <View
                pointerEvents="none"
                style={[styles.vinylSheen, vinylSheenStyle, { borderColor: colors.glass.line16 }]}
              />
              <View style={[styles.recordInner, { borderColor: colors.scrim.vinylInner }]}>
                {prevCover
                  ? (
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        styles.coverLayer,
                        { opacity: prevCoverOpacity, transform: [{ scale: prevCoverScale }] },
                      ]}
                    >
                      <Image style={styles.recordImage} url={prevCover} />
                    </Animated.View>
                    )
                  : null}
                <Animated.View style={[styles.coverLayer, { opacity: currentCoverOpacity, transform: [{ scale: currentCoverScale }] }]}>
                  <Image style={styles.recordImage} url={currentCover} />
                </Animated.View>
                <View style={[styles.centerHole, { backgroundColor: r.paper }]} />
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
              <View style={[styles.tonearmPivotOuter, { backgroundColor: armCore, borderColor: armEdge }]}>
                <View style={[styles.tonearmPivotDot, { backgroundColor: armEdge }]} />
              </View>
              <View style={[styles.tonearmArmOuter, { backgroundColor: armEdge }]} />
              <View style={[styles.tonearmArmInner, { backgroundColor: armCore }]} />
              <View style={[styles.tonearmHead, { backgroundColor: armCore, borderColor: armEdge }]} />
              <View style={[styles.tonearmNeedle, { backgroundColor: r.accent }]} />
            </Animated.View>
          </View>
        </View>

        <View style={styles.flexGapRecord} />

        <View>
          <View style={styles.titleRow}>
            <Text size={32} color={r.display} numberOfLines={2} style={styles.songTitle}>
              {musicInfo.name || '—'}
            </Text>
            <TouchableOpacity
              style={styles.iconBtn}
              activeOpacity={0.7}
              onPress={handleShowMusicAddModal}
              accessibilityRole="button"
              accessibilityLabel={t('add_to')}
            >
              <MdiIcon name="playlist-plus" size={26} color={r.ink} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconBtn}
              activeOpacity={0.7}
              onPress={handleToggleLoved}
              accessibilityRole="button"
            >
              <MdiIcon
                name={isLoved ? 'heart' : 'heart-outline'}
                size={26}
                color={isLoved ? r.like : r.ink}
              />
            </TouchableOpacity>
          </View>
          <View style={styles.metaRow}>
            {source && sourceLabel ? <SourceTag source={source} label={sourceLabel} /> : null}
            {singerMeta
              ? <Text size={magType.meta.size} color={r.muted} numberOfLines={1} style={styles.metaText}>{singerMeta}</Text>
              : null}
          </View>
        </View>

        <View style={styles.flexGapTitle} />

        {hasLyricPreview
          ? (
            <>
              <View style={styles.lyricPreview}>
                <View style={[styles.lyricAccent, { backgroundColor: r.accent }]} />
                <View style={styles.lyricLines}>
                  {currentLyric
                    ? <Text size={17} color={r.ink} numberOfLines={1} style={styles.lyricCurrent}>{currentLyric}</Text>
                    : null}
                  {nextLyric
                    ? <Text size={14} color={r.faint} numberOfLines={1} style={styles.lyricNext}>{nextLyric}</Text>
                    : null}
                </View>
              </View>
              <View style={styles.flexGapLyric} />
            </>
            )
          : <View style={styles.flexGapLyric} />}
      </ScrollView>

      <PlayerTransport
        progress={progress}
        duration={maxPlayTime}
        nowPlayTimeStr={nowPlayTimeStr}
        maxPlayTimeStr={maxPlayTimeStr}
      >
        <TouchableOpacity style={styles.iconBtn} activeOpacity={0.8} onPress={handleTogglePlayMode}>
          <Icon name={playModeIcon} rawSize={22} color={r.ink} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} activeOpacity={0.8} onPress={() => { void playPrev() }}>
          <Icon name="prevMusic" rawSize={28} color={r.ink} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.playBtn, { backgroundColor: r.ink }]}
          activeOpacity={0.85}
          onPress={handleTogglePlay}
        >
          <Icon name={isPlay ? 'pause' : 'play'} rawSize={28} color={r.onInk} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} activeOpacity={0.8} onPress={() => { void playNext() }}>
          <Icon name="nextMusic" rawSize={28} color={r.ink} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} activeOpacity={0.8} onPress={handleToggleQueuePanel}>
          <MdiIcon name="playlist-music" size={24} color={r.ink} />
        </TouchableOpacity>
      </PlayerTransport>
      <MusicAddModal ref={musicAddModalRef} />
    </View>
  )
}

const useLuxStyles = sharedLuxStyles(() => (createStyle({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: PAGE_GUTTER,
  },
  eyebrow: {
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 10,
  },
  /** Absorb leftover height so the control row sits near the bottom on tall screens. */
  flexGapSm: {
    flexGrow: 1,
    flexShrink: 0,
    minHeight: 8,
  },
  flexGapRecord: {
    flexGrow: 1,
    flexShrink: 0,
    minHeight: 30,
  },
  flexGapTitle: {
    flexGrow: 1,
    flexShrink: 0,
    minHeight: 18,
  },
  flexGapLyric: {
    flexGrow: 1,
    flexShrink: 0,
    minHeight: 14,
  },
  recordWrap: {
    alignSelf: 'center',
    position: 'relative',
    overflow: 'visible',
    alignItems: 'center',
    justifyContent: 'center',
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  vinylGroove: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
  },
  vinylSheen: {
    position: 'absolute',
    borderWidth: 1,
    transform: [{ rotate: '-18deg' }],
    opacity: 0.35,
  },
  recordInner: {
    width: '66%',
    height: '66%',
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 1,
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
  centerHole: {
    width: 10,
    height: 10,
    borderRadius: 5,
    zIndex: 2,
  },
  tonearm: {
    position: 'absolute',
    top: 8,
    right: -4,
    width: 120,
    height: 90,
    zIndex: 5,
  },
  tonearmMotion: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  tonearmPivotOuter: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tonearmPivotDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tonearmArmOuter: {
    position: 'absolute',
    top: 11.5,
    right: 22,
    width: 86,
    height: 7,
    borderRadius: 3.5,
  },
  tonearmArmInner: {
    position: 'absolute',
    top: 13,
    right: 24,
    width: 82,
    height: 4,
    borderRadius: 2,
  },
  tonearmHead: {
    position: 'absolute',
    top: 6,
    right: 96,
    width: 20,
    height: 24,
    borderRadius: 2.5,
    borderWidth: 1.5,
  },
  tonearmNeedle: {
    position: 'absolute',
    top: 28,
    right: 102,
    width: 10,
    height: 4,
    borderRadius: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
  },
  songTitle: {
    flex: 1,
    fontWeight: '800',
    letterSpacing: -0.8,
    textAlign: 'left',
  },
  iconBtn: playerTransportControlStyles.iconBtn,
  playBtn: playerTransportControlStyles.playBtn,
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  metaText: {
    flexShrink: 1,
  },
  lyricPreview: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
    minHeight: 48,
  },
  lyricAccent: {
    width: 3,
    borderRadius: 1.5,
  },
  lyricLines: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  lyricCurrent: {
    fontWeight: '800',
  },
  lyricNext: {
    fontWeight: '400',
  },
})))
