import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FlatList, TouchableOpacity, View } from 'react-native'
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
import { navigations } from '@/navigation'
import commonState from '@/store/common/state'

const PREVIEW_COUNT = 3
const COVER_SIZE = scaleSizeW(40)

const BoardCard = memo(({
  item,
  preview,
  onLoadPreview,
  onOpenDetail,
}: {
  item: BoardItem
  preview?: LX.Music.MusicInfoOnline[]
  onLoadPreview: (id: string) => void
  onOpenDetail: (item: BoardItem) => void
}) => {
  const theme = useTheme()

  useEffect(() => {
    if (!preview) onLoadPreview(item.id)
  }, [item.id, onLoadPreview, preview])

  return (
    <Surface style={styles.card} padding={12}>
      <View style={styles.cardHeader}>
        <TouchableOpacity onPress={() => { onOpenDetail(item) }} style={styles.cardTitleWrap} activeOpacity={0.7}>
          <Text style={styles.cardTitle} size={16} numberOfLines={1}>{item.name}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.cardContent}>
        {preview?.length
          ? preview.slice(0, PREVIEW_COUNT).map((song, index) => (
              <View key={`${item.id}_${song.id}_${index}`} style={styles.songRow}>
                <Image style={styles.songCover} url={song.meta.picUrl} />
                <View style={styles.songText}>
                  <Text numberOfLines={1} size={13}>{song.name}</Text>
                  <View style={styles.songMetaRow}>
                    <Text numberOfLines={1} size={11} color={theme['c-500']}>{song.singer}</Text>
                    <Text size={11} color={theme['c-400']} style={styles.metaDivider}>·</Text>
                    <Text numberOfLines={1} size={11} color={theme['c-500']}>{song.source}</Text>
                  </View>
                </View>
              </View>
            ))
          : <Text size={12} color={theme['c-500']}>Loading...</Text>}
      </View>
    </Surface>
  )
})

export default () => {
  const theme = useTheme()
  const t = useI18n()
  const [boards, setBoards] = useState<BoardItem[]>([])
  const [previewMap, setPreviewMap] = useState<Record<string, LX.Music.MusicInfoOnline[]>>({})
  const [currentSource, setCurrentSource] = useState<LX.OnlineSource>('kw')
  const loadingRef = useRef<Set<string>>(new Set())
  const sourceSelectorRef = useRef<SourceSelectorType>(null)
  const [loading, setLoading] = useState(true)

  const loadBoards = useCallback(async(src: LX.OnlineSource) => {
    setLoading(true)
    try {
      const list = await getBoardsList(src)
      setBoards(list)
      if (list.length) {
        void saveLeaderboardSetting({
          source: src,
          boardId: list[0].id,
        })
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
    setPreviewMap({})
    setCurrentSource(src)
    void loadBoards(src)
  }, [loadBoards])

  const handleLoadPreview = useCallback((id: string) => {
    if (previewMap[id] || loadingRef.current.has(id)) return
    loadingRef.current.add(id)
    void getListDetail(id, 1).then((detail) => {
      setPreviewMap(prev => ({
        ...prev,
        [id]: detail.list.slice(0, PREVIEW_COUNT),
      }))
    }).finally(() => {
      loadingRef.current.delete(id)
    })
  }, [previewMap])

  const handleOpenDetail = useCallback((item: BoardItem) => {
    const componentId = commonState.componentIds.home
    if (!componentId) return
    navigations.pushLeaderboardDetailScreen(componentId, {
      source: currentSource,
      boardId: item.id,
      boardName: item.name,
    })
  }, [currentSource])

  const renderItem = useCallback(({ item }: { item: BoardItem }) => (
    <BoardCard
      item={item}
      preview={previewMap[item.id]}
      onLoadPreview={handleLoadPreview}
      onOpenDetail={handleOpenDetail}
    />
  ), [handleLoadPreview, handleOpenDetail, previewMap])

  const data = useMemo(() => boards, [boards])

  return (
    <View style={styles.container}>
      <SectionHeader
        title={t('nav_top')}
        right={<SourceSelector ref={sourceSelectorRef} onSourceChange={handleSourceChange} />}
      />
      <FlatList
        data={data}
        showsVerticalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={(
          <View style={styles.emptyWrap}>
            <Text size={13} color={theme['c-500']}>
              {loading ? '加载中...' : '暂无榜单'}
            </Text>
          </View>
        )}
        contentContainerStyle={styles.listContent}
        initialNumToRender={4}
        windowSize={5}
        removeClippedSubviews
        style={{ backgroundColor: theme['c-content-background'] }}
      />
    </View>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 16,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  card: {
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitleWrap: {
    flex: 1,
  },
  cardTitle: {
    flex: 1,
  },
  cardContent: {
  },
  songRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
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
  songMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  metaDivider: {
    marginHorizontal: 6,
  },
})
