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

export default () => {
  const [activeTab, setActiveTab] = useState<'playlists' | 'favorites' | 'downloads' | 'recent'>('playlists')
  const t = useI18n()
  const theme = useTheme()

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
      <SectionHeader title={t('nav_love')} />
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
  playlistSongs: {
    flex: 1,
  },
})
