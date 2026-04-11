/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FlatList, ScrollView, TouchableOpacity, View } from 'react-native'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import { getBoardsList, getListDetail } from '@/core/leaderboard'
import { getList as getHotSearchList } from '@/core/hotSearch'
import { getSearchSetting } from '@/utils/data'
import type { BoardItem } from '@/store/leaderboard/state'
import { useI18n } from '@/lang'
import SectionHeader from '@/components/modern/SectionHeader'
import Surface from '@/components/modern/Surface'
import { Icon } from '@/components/common/Icon'

const CARD_WIDTH = 160
const CARD_GAP = 12
const PREVIEW_COUNT = 3

const BoardCard = memo(({
  item,
  preview,
  onLoadPreview,
}: {
  item: BoardItem
  preview?: LX.Music.MusicInfoOnline[]
  onLoadPreview: (id: string) => void
}) => {
  const theme = useTheme()

  useEffect(() => {
    if (!preview) onLoadPreview(item.id)
  }, [item.id, onLoadPreview, preview])

  const cover = preview?.[0]?.meta.picUrl ?? null
  const topName = preview?.[0]?.name ?? ''
  const topSinger = preview?.[0]?.singer ?? ''

  return (
    <View style={styles.cardWrap}>
      <Surface style={styles.card} padding={0}>
        <Image style={styles.cardImage} url={cover} />
        <View style={styles.cardOverlay} />
      </Surface>
      <View style={styles.cardBody}>
        <Text size={14} numberOfLines={1}>{item.name}</Text>
        <Text size={12} color={theme['c-500']} numberOfLines={1}>{topName}</Text>
        <Text size={11} color={theme['c-500']} numberOfLines={1}>{topSinger}</Text>
      </View>
    </View>
  )
})

export default memo(({ onSearch }: { onSearch: (keyword: string) => void }) => {
  const theme = useTheme()
  const t = useI18n()
  const [boards, setBoards] = useState<BoardItem[]>([])
  const [previewMap, setPreviewMap] = useState<Record<string, LX.Music.MusicInfoOnline[]>>({})
  const [hotList, setHotList] = useState<string[]>([])
  const [topList, setTopList] = useState<LX.Music.MusicInfoOnline[]>([])
  const loadingRef = useRef<Set<string>>(new Set())

  const loadBoards = useCallback(async(source: LX.OnlineSource) => {
    const list = await getBoardsList(source)
    setBoards(list)
    if (list.length) {
      void getListDetail(list[0].id, 1).then(detail => {
        setTopList(detail.list.slice(0, 10))
      })
    }
  }, [])

  useEffect(() => {
    void getSearchSetting().then(({ source }) => {
      void loadBoards(source)
      void getHotSearchList(source).then(list => setHotList(list.slice(0, 12)))
    })
  }, [loadBoards])

  const handleLoadPreview = useCallback((id: string) => {
    if (previewMap[id] || loadingRef.current.has(id)) return
    loadingRef.current.add(id)
    void getListDetail(id, 1).then(detail => {
      setPreviewMap(prev => ({
        ...prev,
        [id]: detail.list.slice(0, PREVIEW_COUNT),
      }))
    }).finally(() => {
      loadingRef.current.delete(id)
    })
  }, [previewMap])

  const renderCard = useCallback(({ item }: { item: BoardItem }) => (
    <BoardCard
      item={item}
      preview={previewMap[item.id]}
      onLoadPreview={handleLoadPreview}
    />
  ), [handleLoadPreview, previewMap])

  const cardData = useMemo(() => boards, [boards])

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <SectionHeader title={t('discover_for_you')} subtitle={t('discover_for_you_sub')} />
      <FlatList
        data={cardData.slice(0, 4)}
        numColumns={2}
        scrollEnabled={false}
        keyExtractor={(item) => item.id}
        renderItem={renderCard}
        columnWrapperStyle={styles.cardRow}
        contentContainerStyle={styles.cardGrid}
      />

      <SectionHeader title={t('discover_top_picks')} subtitle={t('discover_top_picks_sub')} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mixRow}>
        {topList.slice(0, 8).map((item) => (
          <View key={item.id} style={styles.mixItem}>
            <Surface style={styles.mixCoverWrap} padding={4}>
              <Image style={styles.mixCover} url={item.meta.picUrl} />
            </Surface>
            <Text size={11} numberOfLines={1} style={styles.mixLabel}>{item.name}</Text>
          </View>
        ))}
      </ScrollView>

      <SectionHeader title={t('discover_hot_search')} subtitle={t('discover_hot_search_sub')} />
      <View style={styles.chipRow}>
        {hotList.map((text) => (
          <TouchableOpacity
            key={text}
            style={[styles.chip, {
              borderColor: theme['c-border-background'],
              backgroundColor: theme['c-main-background'],
              marginRight: 8,
              marginBottom: 8,
            }]}
            onPress={() => { onSearch(text) }}
          >
            <Text size={12}>{text}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <SectionHeader title={t('discover_top_picks')} subtitle={t('discover_top_picks_sub')} />
      <View style={styles.list}>
        {topList.map((item) => (
          <Surface key={item.id} style={styles.listItem} padding={10}>
            <Image style={styles.listImage} url={item.meta.picUrl} />
            <View style={styles.listText}>
              <Text size={14} numberOfLines={1}>{item.name}</Text>
              <Text size={12} color={theme['c-500']} numberOfLines={1}>{item.singer}</Text>
            </View>
            <View style={styles.listAction}>
              <Icon name="play" size={14} color={theme['c-600']} />
            </View>
          </Surface>
        ))}
      </View>
    </ScrollView>
  )
})

const styles = createStyle({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 24,
  },
  cardGrid: {
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  cardRow: {
    justifyContent: 'space-between',
  },
  cardWrap: {
    width: '48%',
    marginBottom: 14,
  },
  card: {
    width: '100%',
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: 150,
  },
  cardOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 50,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  cardBody: {
    paddingTop: 8,
  },
  mixRow: {
    paddingHorizontal: 14,
    paddingBottom: 6,
  },
  mixItem: {
    width: 96,
    marginRight: 12,
    alignItems: 'center',
  },
  mixCoverWrap: {
    borderRadius: 999,
  },
  mixCover: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  mixLabel: {
    marginTop: 8,
    textAlign: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 14,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  list: {
    paddingHorizontal: 14,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  listImage: {
    width: 48,
    height: 48,
    borderRadius: 10,
  },
  listText: {
    flex: 1,
    marginLeft: 10,
  },
  listAction: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
  },
})
