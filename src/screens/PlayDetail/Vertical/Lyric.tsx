/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FlatList, TouchableOpacity, View, type ListRenderItemInfo } from 'react-native'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { MdiIcon } from '@/components/common/MdiIcon'
import Image from '@/components/common/Image'
import MusicAddModal, { type MusicAddModalType } from '@/components/MusicAddModal'
import { Hairline } from '@/components/magazine'
import { LIST_IDS, MUSIC_TOGGLE_MODE, MUSIC_TOGGLE_MODE_LIST } from '@/config/constant'
import { updateSetting } from '@/core/common'
import { getListMusics } from '@/core/list'
import { collectMusic, playNext, playPrev, togglePlay, uncollectMusic } from '@/core/player/player'
import { useI18n } from '@/lang'
import { useLrcPlay, useLrcSet } from '@/plugins/lyric'
import { useIsPlay, usePlayMusicInfo, usePlayerMusicInfo, useProgress } from '@/store/player/hook'
import { useSettingValue } from '@/store/setting/hook'
import { createStyle, toast } from '@/utils/tools'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { PAGE_GUTTER, magType } from '@/theme/magazineType'
import { PlayerTransport, playerTransportControlStyles } from './PlayerTransport'

export default ({ active }: { active: boolean }) => {
  const styles = useLuxStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const t = useI18n()
  const musicInfo = usePlayerMusicInfo()
  const playMusicInfo = usePlayMusicInfo()
  const togglePlayMethod = useSettingValue('player.togglePlayMethod')
  const isPlay = useIsPlay()
  const { line } = useLrcPlay(active)
  const { progress, maxPlayTime, nowPlayTimeStr, maxPlayTimeStr } = useProgress(active)
  const lyricLines = useLrcSet()
  const listRef = useRef<FlatList<string>>(null)
  const loveCheckId = useRef(0)
  const musicAddModalRef = useRef<MusicAddModalType>(null)
  const [isLoved, setIsLoved] = useState(false)

  const lines = useMemo(() => {
    if (!lyricLines.length) return [] as string[]
    return lyricLines.map(item => item.text).filter(Boolean)
  }, [lyricLines])

  useEffect(() => {
    if (!active || line < 0 || line >= lines.length) return
    try {
      listRef.current?.scrollToIndex({ index: line, viewPosition: 0.42, animated: true })
    } catch {}
  }, [active, line, lines.length])

  const refreshLovedState = useCallback(async(targetId?: string | null) => {
    const musicId = targetId ?? musicInfo.id
    if (!musicId) {
      setIsLoved(false)
      return
    }
    const currentCheckId = ++loveCheckId.current
    const loveList = await getListMusics(LIST_IDS.LOVE)
    if (currentCheckId != loveCheckId.current) return
    setIsLoved(loveList.some(song => String(song.id) == String(musicId)))
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
    if (nextLoved) void collectMusic()
    else void uncollectMusic()
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

  const handleTogglePlayMode = () => {
    let index = MUSIC_TOGGLE_MODE_LIST.indexOf(togglePlayMethod)
    if (++index >= MUSIC_TOGGLE_MODE_LIST.length) index = 0
    const mode = MUSIC_TOGGLE_MODE_LIST[index]
    updateSetting({ 'player.togglePlayMethod': mode })
    let modeName: 'play_list_loop' | 'play_list_random' | 'play_list_order' | 'play_single_loop' | 'play_single'
    switch (mode) {
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

  const renderItem = useCallback(({ item, index }: ListRenderItemInfo<string>) => {
    const activeLine = index === line
    const past = index < line
    return (
      <View style={styles.lineWrap}>
        {activeLine ? <View style={[styles.lineAccent, { backgroundColor: r.accent }]} /> : null}
        <Text
          size={activeLine ? 28 : 18}
          color={activeLine ? r.display : past ? r.faint : r.muted}
          style={activeLine ? styles.activeLineText : styles.lineText}
        >
          {item}
        </Text>
      </View>
    )
  }, [line, r.accent, r.display, r.faint, r.muted, styles])

  const listHeader = (
    <View>
      <View style={styles.songHead}>
        <Image style={styles.cover} url={musicInfo.pic} />
        <View style={styles.songText}>
          <Text size={magType.rowTitle.size} color={r.ink} numberOfLines={1} style={styles.songTitle}>
            {musicInfo.name || '—'}
          </Text>
          <Text size={magType.meta.size} color={r.muted} numberOfLines={1}>
            {musicInfo.singer || ''}
          </Text>
        </View>
        <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7} onPress={handleToggleLoved}>
          <MdiIcon
            name={isLoved ? 'heart' : 'heart-outline'}
            size={22}
            color={isLoved ? r.like : r.ink}
          />
        </TouchableOpacity>
      </View>
      <Hairline style={styles.headRule} />
    </View>
  )

  return (
    <View style={[styles.container, { backgroundColor: r.paper }]}>
      <FlatList
        ref={listRef}
        data={lines}
        renderItem={renderItem}
        keyExtractor={(item, index) => `${index}_${item}`}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={(
          <Text size={15} color={r.faint} style={styles.empty}>{t('player_lyric_empty')}</Text>
        )}
        showsVerticalScrollIndicator={false}
        onScrollToIndexFailed={() => {}}
      />

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
          <Icon name="prevMusic" rawSize={26} color={r.ink} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.playBtn, { backgroundColor: r.ink }]}
          activeOpacity={0.85}
          onPress={togglePlay}
        >
          <Icon name={isPlay ? 'pause' : 'play'} rawSize={26} color={r.onInk} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} activeOpacity={0.8} onPress={() => { void playNext() }}>
          <Icon name="nextMusic" rawSize={26} color={r.ink} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} activeOpacity={0.8} onPress={handleShowMusicAddModal}>
          <MdiIcon name="playlist-plus" size={24} color={r.ink} />
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
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: PAGE_GUTTER,
    paddingTop: 12,
    paddingBottom: 24,
  },
  songHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
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
  songTitle: {
    fontWeight: '700',
    marginBottom: 2,
  },
  headRule: {
    marginBottom: 18,
  },
  lineWrap: {
    position: 'relative',
    paddingLeft: 14,
    marginBottom: 16,
    minHeight: 36,
    justifyContent: 'center',
  },
  lineAccent: {
    position: 'absolute',
    left: 0,
    top: 4,
    bottom: 4,
    width: 3,
    borderRadius: 1.5,
  },
  lineText: {
    fontWeight: '600',
    lineHeight: 28,
  },
  activeLineText: {
    fontWeight: '800',
    lineHeight: 36,
    letterSpacing: -0.5,
  },
  empty: {
    marginTop: 40,
    textAlign: 'center',
  },
  iconBtn: playerTransportControlStyles.iconBtn,
  playBtn: playerTransportControlStyles.playBtn,
})))
