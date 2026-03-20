import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FlatList, ScrollView, TextInput, TouchableOpacity, View, type ListRenderItem } from 'react-native'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import Image from '@/components/common/Image'
import { createStyle } from '@/utils/tools'
import { useStatusbarHeight } from '@/store/common/hook'
import { useMyList } from '@/store/list/hook'
import { getListMusics, setActiveList } from '@/core/list'
import { playList } from '@/core/player/player'
import { LIST_IDS } from '@/config/constant'

const SHOW_LISTENING_STATISTICS = false

const stats: Array<{ day: string, height: `${number}%`, active?: boolean }> = [
  { day: 'Mon', height: '40%' },
  { day: 'Tue', height: '65%' },
  { day: 'Wed', height: '85%' },
  { day: 'Thu', height: '50%', active: true },
  { day: 'Fri', height: '70%' },
  { day: 'Sat', height: '95%' },
  { day: 'Sun', height: '30%' },
]

export default () => {
  const statusBarHeight = useStatusbarHeight()
  const headerTopPadding = statusBarHeight + 8
  const headerHeight = headerTopPadding + 46 + 8
  const playlists = useMyList()
  const [playlistMetaMap, setPlaylistMetaMap] = useState<Record<string, { count: number, pic: string | null }>>({})
  const [selectedListId, setSelectedListId] = useState<string | null>(null)
  const [detailSongs, setDetailSongs] = useState<LX.Music.MusicInfo[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const detailRequestIdRef = useRef(0)
  const lovePlaylist = useMemo(() => playlists.find(list => list.id === LIST_IDS.LOVE) ?? null, [playlists])
  const displayPlaylists = useMemo(() => playlists.filter(list => list.id !== LIST_IDS.LOVE), [playlists])
  const likedSongsCount = lovePlaylist ? playlistMetaMap[lovePlaylist.id]?.count ?? 0 : 0

  const pickCover = (list: LX.Music.MusicInfo[]) => {
    for (const song of list) {
      if (song.meta.picUrl) return song.meta.picUrl
    }
    return null
  }

  const updatePlaylistMeta = useCallback(async(ids: string[]) => {
    if (!ids.length) return
    const result = await Promise.all(ids.map(async(id) => {
      const list = await getListMusics(id)
      return {
        id,
        count: list.length,
        pic: pickCover(list),
      }
    }))
    setPlaylistMetaMap((prev) => {
      const next = { ...prev }
      for (const item of result) {
        next[item.id] = {
          count: item.count,
          pic: item.pic,
        }
      }
      return next
    })
  }, [])

  const loadDetailSongs = useCallback(async(id: string, showLoading = false) => {
    const requestId = ++detailRequestIdRef.current
    if (showLoading) setDetailLoading(true)
    const list = await getListMusics(id)
    if (requestId !== detailRequestIdRef.current) return
    setDetailSongs([...list])
    if (showLoading) setDetailLoading(false)
  }, [])

  useEffect(() => {
    void updatePlaylistMeta(playlists.map(list => list.id))
    if (selectedListId && !playlists.some(list => list.id === selectedListId)) {
      setSelectedListId(null)
      setDetailSongs([])
    }
  }, [playlists, selectedListId, updatePlaylistMeta])

  useEffect(() => {
    const handleMusicUpdate = (ids: string[]) => {
      void updatePlaylistMeta(ids)
      if (selectedListId && ids.includes(selectedListId)) {
        void loadDetailSongs(selectedListId)
      }
    }
    global.app_event.on('myListMusicUpdate', handleMusicUpdate)
    return () => {
      global.app_event.off('myListMusicUpdate', handleMusicUpdate)
    }
  }, [loadDetailSongs, selectedListId, updatePlaylistMeta])

  const handleOpenList = (list: LX.List.MyListInfo) => {
    setSelectedListId(list.id)
    setDetailSongs([])
    void loadDetailSongs(list.id, true)
  }

  const handlePlaySong = useCallback(async(listId: string, song: LX.Music.MusicInfo, fallbackIndex: number) => {
    setActiveList(listId)
    const latestList = await getListMusics(listId)
    let targetIndex = latestList.findIndex(item => item.id === song.id && item.source === song.source)
    if (targetIndex < 0) targetIndex = latestList.findIndex(item => item.id === song.id)
    if (targetIndex < 0) targetIndex = fallbackIndex
    if (targetIndex < 0) return
    await playList(listId, targetIndex)
  }, [])
  const selectedListInfo = selectedListId ? playlists.find(list => list.id === selectedListId) ?? null : null
  const selectedListMeta = selectedListInfo ? playlistMetaMap[selectedListInfo.id] : null
  const renderSongItem: ListRenderItem<LX.Music.MusicInfo> = useCallback(({ item, index }) => {
    if (!selectedListId) return null
    return (
      <TouchableOpacity
        style={styles.songItem}
        activeOpacity={0.8}
        onPress={() => { void handlePlaySong(selectedListId, item, index) }}
      >
        <Image style={styles.songPic} url={item.meta.picUrl ?? null} />
        <View style={styles.songInfo}>
          <Text size={14} color="#111827" style={styles.listTitle} numberOfLines={1}>{item.name}</Text>
          <View style={styles.songMetaRow}>
            <Text size={10} color="#7f0df2" style={styles.songSource}>{item.source.toUpperCase()}</Text>
            <Text size={11} color="#6b7280" numberOfLines={1}>{item.singer}</Text>
          </View>
        </View>
        <Text size={11} color="#9ca3af">{item.interval ?? '--:--'}</Text>
      </TouchableOpacity>
    )
  }, [handlePlaySong, selectedListId])
  const detailHeader = useMemo(() => {
    if (!selectedListInfo) return null
    return (
      <>
        <View style={[styles.header, { paddingTop: statusBarHeight + 8 }]}>
          <TouchableOpacity style={styles.detailBackBtn} activeOpacity={0.8} onPress={() => { setSelectedListId(null) }}>
            <Icon name="chevron-left" rawSize={20} color="#111827" />
          </TouchableOpacity>
        </View>

        <View style={styles.detailHero}>
          <Image style={styles.detailHeroCover} url={selectedListMeta?.pic ?? null} />
          <View style={styles.detailHeroText}>
            <Text size={22} color="#111827" style={styles.profileName} numberOfLines={1}>{selectedListInfo.name}</Text>
            <Text size={12} color="#6b7280">{`${selectedListMeta?.count ?? 0} songs`}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text size={18} color="#111827" style={styles.sectionTitle}>Songs</Text>
          </View>
        </View>
      </>
    )
  }, [selectedListInfo, selectedListMeta?.pic, selectedListMeta?.count, statusBarHeight])

  if (selectedListInfo) {
    return (
      <FlatList
        style={styles.container}
        contentContainerStyle={styles.detailContent}
        data={detailSongs}
        renderItem={renderSongItem}
        keyExtractor={(item, index) => `${item.id}_${item.source}_${index}`}
        ListHeaderComponent={detailHeader}
        ListEmptyComponent={(
          <View style={styles.emptyCard}>
            <Text size={13} color="#6b7280">{detailLoading ? 'Loading songs...' : 'No songs in this playlist'}</Text>
          </View>
        )}
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
        windowSize={8}
        maxToRenderPerBatch={12}
        bounces={false}
        alwaysBounceVertical={false}
        overScrollMode="never"
      />
    )
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, styles.headerFloating, { paddingTop: headerTopPadding }]}>
        <View style={styles.searchWrap}>
          <Icon name="search-2" rawSize={18} color="#9ca3af" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search songs, artists, playlists..."
            placeholderTextColor="#9ca3af"
          />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: headerHeight + 12 }]}
        showsVerticalScrollIndicator={false}
        bounces={false}
        alwaysBounceVertical={false}
        overScrollMode="never"
      >
        <View style={styles.profileSection}>
          <View style={styles.avatarWrap}>
            <Image
              style={styles.avatar}
              url="https://lh3.googleusercontent.com/aida-public/AB6AXuAcVca8jY8f-JP2fdUKrHa_XFfVv4N77gpir_i1Q-OurG6uswWSse3yJNJJbZGpnM2tQ050EHA3ZGui2TJgYQCuiLjFgMR3sGA7R602hWmDCqTJ0ABPvqfNVwgSqTKgeY9ojtsoEXx1hi-SmEyE_lTXJnzVRT-XoPMSwq82IZLvnaOAg4IVTJ5Y1lKuksGcqjxLc448H-n0G9AlKAO0ZvRn-jqY3boR70xtpI1fJo8ou-0ZtR-AkL9CmhAzGR0K9nPhk-rt5yI7-tE"
            />
          </View>
          <View style={styles.profileInfo}>
            <Text size={24} color="#111827" style={styles.profileName}>Alex Rivera</Text>
            <Text size={12} color="#6b7280">Gold Member - 128 Following</Text>
          </View>
        </View>

        <View style={styles.quickRow}>
          <TouchableOpacity
            style={styles.quickCard}
            activeOpacity={0.8}
            onPress={() => {
              if (lovePlaylist) handleOpenList(lovePlaylist)
            }}
          >
            <View style={[styles.quickIconBox, { backgroundColor: '#fee2e2' }]}>
              <Icon name="love" rawSize={18} color="#ef4444" />
            </View>
            <View style={styles.quickTextBox}>
              <Text size={13} color="#111827" style={styles.quickTitle}>Liked Songs</Text>
              <Text size={11} color="#6b7280">{`${likedSongsCount} tracks`}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.quickCard, styles.quickCardLast]} activeOpacity={0.8}>
            <View style={[styles.quickIconBox, { backgroundColor: '#dbeafe' }]}>
              <Icon name="download-2" rawSize={18} color="#3b82f6" />
            </View>
            <View style={styles.quickTextBox}>
              <Text size={13} color="#111827" style={styles.quickTitle}>Local Songs</Text>
              <Text size={11} color="#6b7280">86 tracks</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text size={18} color="#111827" style={styles.sectionTitle}>My Playlists</Text>
            <TouchableOpacity activeOpacity={0.8} onPress={() => { global.app_event.changeLoveListVisible(true) }}>
              <Text size={13} color="#7f0df2" style={styles.sectionTag}>+ Create New</Text>
            </TouchableOpacity>
          </View>
          <View>
            {displayPlaylists.map(item => (
              <TouchableOpacity key={item.id} style={styles.listItem} activeOpacity={0.8} onPress={() => { handleOpenList(item) }}>
                <Image style={styles.listPic} url={playlistMetaMap[item.id]?.pic ?? null} />
                <View style={styles.listInfo}>
                  <Text size={14} color="#111827" style={styles.listTitle}>{item.name}</Text>
                  <Text size={11} color="#6b7280">{`${playlistMetaMap[item.id]?.count ?? 0} songs`}</Text>
                </View>
                <Icon name="chevron-right" rawSize={16} color="#9ca3af" />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {SHOW_LISTENING_STATISTICS
          ? <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text size={18} color="#111827" style={styles.sectionTitle}>Listening Statistics</Text>
                <Text size={11} color="#7f0df2" style={styles.sectionTag}>Last 7 Days</Text>
              </View>
              <View style={styles.statsCard}>
                {stats.map(item => (
                  <View key={item.day} style={styles.statsCol}>
                    <View style={styles.statsBarBg}>
                      <View style={[styles.statsBar, { height: item.height, opacity: item.active ? 1 : 0.45 }]} />
                    </View>
                    <Text size={10} color={item.active ? '#111827' : '#9ca3af'} style={item.active ? styles.dayActive : styles.day}>
                      {item.day}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          : null}
      </ScrollView>
    </View>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  content: {
    paddingBottom: 0,
  },
  scroll: {
    flex: 1,
  },
  detailContent: {
    paddingBottom: 0,
    paddingHorizontal: 16,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerFloating: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    elevation: 6,
    backgroundColor: '#f8f9fa',
  },
  detailBackBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f1f1f3',
  },
  searchWrap: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    color: '#111827',
    fontSize: 13,
    paddingVertical: 0,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  avatarWrap: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: '#7f0df2',
    padding: 3,
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 39,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 12,
  },
  profileName: {
    fontWeight: '700',
    marginBottom: 2,
  },
  quickRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  quickCard: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f1f1f3',
    backgroundColor: '#ffffff',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  quickCardLast: {
    marginRight: 0,
  },
  quickIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickTextBox: {
    marginLeft: 8,
    flex: 1,
  },
  quickTitle: {
    fontWeight: '600',
    marginBottom: 2,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  detailHero: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  detailHeroCover: {
    width: 88,
    height: 88,
    borderRadius: 12,
  },
  detailHeroText: {
    flex: 1,
    marginLeft: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontWeight: '600',
  },
  sectionTag: {
    fontWeight: '500',
  },
  statsCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f1f1f3',
    backgroundColor: '#ffffff',
    padding: 12,
    height: 184,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  statsCol: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  statsBarBg: {
    width: '74%',
    flex: 1,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    backgroundColor: '#f3e8ff',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  statsBar: {
    width: '100%',
    backgroundColor: '#7f0df2',
  },
  day: {
    marginTop: 8,
  },
  dayActive: {
    marginTop: 8,
    fontWeight: '700',
  },
  listItem: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f1f1f3',
    backgroundColor: '#ffffff',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  listPic: {
    width: 58,
    height: 58,
    borderRadius: 8,
  },
  listInfo: {
    flex: 1,
    marginLeft: 10,
  },
  listTitle: {
    fontWeight: '500',
    marginBottom: 2,
  },
  songItem: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f1f1f3',
    backgroundColor: '#ffffff',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  songPic: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
  songInfo: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
  },
  songMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  songSource: {
    borderRadius: 10,
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#f3e8ff',
    marginRight: 6,
    fontWeight: '600',
  },
  emptyCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f1f1f3',
    backgroundColor: '#ffffff',
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
