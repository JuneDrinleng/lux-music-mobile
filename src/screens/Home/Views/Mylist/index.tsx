import { useEffect, useMemo, useState } from 'react'
import { TouchableOpacity, View } from 'react-native'
import MusicList from './MusicList'
import MyList from './MyList'
import { createStyle } from '@/utils/tools'
import Download from '../Download'
import RecentList from './RecentList'
import { setActiveList } from '@/core/list'
import { LIST_IDS } from '@/config/constant'
import SectionHeader from '@/components/modern/SectionHeader'
import { useI18n } from '@/lang'
import Surface from '@/components/modern/Surface'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'
import { useMyList } from '@/store/list/hook'

const SHOW_LISTENING_STATISTICS = false

export default () => {
  const [activeTab, setActiveTab] = useState<'playlists' | 'favorites' | 'downloads' | 'recent'>('playlists')
  const t = useI18n()
  const theme = useTheme()
  const lists = useMyList()
  const userPlaylistsCount = Math.max(0, lists.length - 2)
  const stats = [40, 65, 85, 50, 70, 95, 30]

  useEffect(() => {
    if (activeTab === 'favorites') setActiveList(LIST_IDS.LOVE)
  }, [activeTab])

  const quickItems = useMemo(() => ([
    { id: 'favorites', label: t('library_tab_favorites'), icon: 'love' },
    { id: 'recent', label: t('library_tab_recent'), icon: 'play' },
    { id: 'downloads', label: t('library_tab_downloads'), icon: 'download-2' },
  ] as const), [t])

  return (
    <View style={styles.container}>
      <View style={styles.profileWrap}>
        <View style={[styles.avatar, { backgroundColor: theme['c-primary-light-700-alpha-300'] }]}>
          <Text size={18} color={theme['c-primary']}>LX</Text>
        </View>
        <View style={styles.profileText}>
          <Text size={18} numberOfLines={1}>MusicFlow</Text>
          <Text size={12} color={theme['c-500']}>{`${userPlaylistsCount} playlists • Light Mode`}</Text>
        </View>
      </View>
      <SectionHeader title="Quick Access" />
      <View style={styles.quickRow}>
        {quickItems.map(item => {
          const active = activeTab === item.id
          return (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.8}
              style={styles.quickItemWrap}
              onPress={() => { setActiveTab(item.id) }}
            >
              <Surface
                style={{
                  ...styles.quickItem,
                  borderColor: active ? theme['c-primary-light-700'] : theme['c-border-background'],
                }}
                padding={10}
              >
                <Icon name={item.icon} size={18} color={active ? theme['c-primary-font-active'] : theme['c-font']} />
                <Text size={12} color={active ? theme['c-primary-font-active'] : theme['c-font']} style={styles.quickLabel}>
                  {item.label}
                </Text>
              </Surface>
            </TouchableOpacity>
          )
        })}
      </View>
      {SHOW_LISTENING_STATISTICS
        ? <>
            <SectionHeader title="Listening Statistics" subtitle="Last 7 Days" />
            <Surface style={styles.statsCard} padding={12}>
              <View style={styles.statsRow}>
                {stats.map((h, index) => (
                  <View key={`${h}_${index}`} style={styles.statsCol}>
                    <View style={[styles.statsBar, { height: `${h}%`, backgroundColor: theme['c-primary-light-700-alpha-300'] }]} />
                  </View>
                ))}
              </View>
            </Surface>
          </>
        : null}
      <View style={styles.content}>
        {
          activeTab === 'playlists'
            ? (
              <View style={styles.playlists}>
                <SectionHeader title={t('library_tab_playlists')} />
                <Surface style={styles.playlistCard} padding={8}>
                  <MyList alwaysVisible />
                </Surface>
                <View style={styles.playlistSongs}>
                  <MusicList />
                </View>
              </View>
              )
            : null
        }
        { activeTab === 'favorites' ? <MusicList /> : null }
        { activeTab === 'downloads' ? <Download /> : null }
        { activeTab === 'recent' ? <RecentList /> : null }
      </View>
    </View>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingTop: 6,
  },
  profileWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileText: {
    marginLeft: 12,
    flex: 1,
  },
  quickRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 6,
  },
  quickItemWrap: {
    flex: 1,
    marginRight: 10,
  },
  quickItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: {
    marginTop: 6,
  },
  playlists: {
    flex: 1,
  },
  playlistCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    maxHeight: 260,
  },
  statsCard: {
    marginHorizontal: 16,
    marginBottom: 10,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 120,
  },
  statsCol: {
    flex: 1,
    marginHorizontal: 4,
    height: '100%',
    justifyContent: 'flex-end',
  },
  statsBar: {
    width: '100%',
    borderRadius: 4,
  },
  playlistSongs: {
    flex: 1,
  },
})
