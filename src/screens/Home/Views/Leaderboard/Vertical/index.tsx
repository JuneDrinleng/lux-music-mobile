/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FlatList, ScrollView, TouchableOpacity, View } from 'react-native'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { scaleSizeW } from '@/utils/pixelRatio'
import Text from '@/components/common/Text'
import SourceSelector, { type SourceSelectorType } from './HeaderBar/SourceSelector'
import { getLeaderboardSetting, saveLeaderboardSetting } from '@/utils/data'
import { getBoardsList, getListDetail } from '@/core/leaderboard'
import type { BoardItem } from '@/store/leaderboard/state'
import leaderboardState from '@/store/leaderboard/state'
import Image from '@/components/common/Image'
import Surface from '@/components/modern/Surface'
import SectionHeader from '@/components/modern/SectionHeader'
import SearchBar from '@/components/modern/SearchBar'

const COVER_SIZE = scaleSizeW(44)

export default () => {
  const theme = useTheme()
  const t = useI18n()
  const [boards, setBoards] = useState<BoardItem[]>([])
  const [currentSource, setCurrentSource] = useState<LX.OnlineSource>('kw')
  const loadingRef = useRef<Set<string>>(new Set())
  const sourceSelectorRef = useRef<SourceSelectorType>(null)
  const [loading, setLoading] = useState(true)
  const [activeBoardId, setActiveBoardId] = useState('')
  const [rankList, setRankList] = useState<LX.Music.MusicInfoOnline[]>([])
  const [searchText, setSearchText] = useState('')

  const loadBoards = useCallback(async(src: LX.OnlineSource) => {
    setLoading(true)
    try {
      const list = await getBoardsList(src)
      setBoards(list)
      if (list.length) {
        const nextBoardId = list[0].id
        setActiveBoardId(nextBoardId)
        void saveLeaderboardSetting({
          source: src,
          boardId: nextBoardId,
        })
        void getListDetail(nextBoardId, 1).then(detail => setRankList(detail.list))
      }
    } catch {
      setBoards([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void getLeaderboardSetting().then(({ source: savedSource }) => {
      const validSource = leaderboardState.sources.includes(savedSource)
        ? savedSource
        : (leaderboardState.sources[0] ?? 'kw')
      sourceSelectorRef.current?.setSource(validSource)
      setCurrentSource(validSource)
      void loadBoards(validSource)
    })
  }, [loadBoards])

  const handleSourceChange = useCallback((src: LX.OnlineSource) => {
    setBoards([])
    setCurrentSource(src)
    void loadBoards(src)
  }, [loadBoards])

  const handleSelectBoard = useCallback((item: BoardItem) => {
    if (loadingRef.current.has(item.id)) return
    setActiveBoardId(item.id)
    loadingRef.current.add(item.id)
    void getListDetail(item.id, 1).then(detail => {
      setRankList(detail.list)
    }).finally(() => {
      loadingRef.current.delete(item.id)
    })
  }, [])

  return (
    <View style={styles.container}>
      <View style={styles.searchWrap}>
        <SearchBar
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search songs, artists, albums..."
        />
      </View>
      <SectionHeader
        title={t('nav_top')}
        right={<SourceSelector ref={sourceSelectorRef} onSourceChange={handleSourceChange} />}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {boards.map(board => {
          const active = board.id === activeBoardId
          return (
            <TouchableOpacity
              key={board.id}
              onPress={() => handleSelectBoard(board)}
              activeOpacity={0.8}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? theme['c-primary'] : theme['c-main-background'],
                  borderColor: active ? theme['c-primary'] : theme['c-border-background'],
                },
              ]}
            >
              <Text size={12} color={active ? '#fff' : theme['c-font']}>{board.name}</Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>
      <FlatList
        data={rankList}
        showsVerticalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => (
          <Surface style={styles.rankItem} padding={10}>
            <Text style={styles.rankIndex} size={16} color={index < 3 ? theme['c-primary'] : theme['c-500']}>
              {index + 1}
            </Text>
            <Image style={styles.songCover} url={item.meta.picUrl} />
            <View style={styles.songText}>
              <Text numberOfLines={1} size={14}>{item.name}</Text>
              <Text numberOfLines={1} size={11} color={theme['c-500']}>{item.singer}</Text>
            </View>
          </Surface>
        )}
        ListEmptyComponent={(
          <View style={styles.emptyWrap}>
            <Text size={13} color={theme['c-500']}>
              {loading ? '加载中...' : '暂无榜单'}
            </Text>
          </View>
        )}
        style={{ backgroundColor: theme['c-content-background'] }}
      />
    </View>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
  },
  searchWrap: {
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  chipRow: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 8,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  rankItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  rankIndex: {
    width: 26,
    textAlign: 'center',
  },
  songCover: {
    width: COVER_SIZE,
    height: COVER_SIZE,
    borderRadius: 6,
    marginRight: 10,
  },
  songText: {
    flex: 1,
  },
})
