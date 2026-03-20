import { ScrollView, Switch, TextInput, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { createStyle } from '@/utils/tools'
import { useStatusbarHeight } from '@/store/common/hook'
import Source from '@/screens/Home/Views/Setting/settings/Basic/Source'
import Sync from '@/screens/Home/Views/Setting/settings/Sync'

const SHOW_ADVANCED_SWITCHES = false

const settingItems = [
  { title: 'App Theme', subtitle: 'Light Mode', icon: 'setting', enabled: true },
  { title: 'High Quality Streaming', subtitle: 'Use better audio quality on Wi-Fi', icon: 'play', enabled: true },
  { title: 'Download over Cellular', subtitle: 'Allow mobile data download', icon: 'download-2', enabled: false },
  { title: 'Show Notifications', subtitle: 'Mini controls on lock screen', icon: 'menu', enabled: true },
]

export default () => {
  const statusBarHeight = useStatusbarHeight()
  const headerTopPadding = statusBarHeight + 8
  const headerHeight = headerTopPadding + 46 + 8

  return (
    <View style={styles.container}>
      <View style={[styles.header, styles.headerFloating, { paddingTop: headerTopPadding }]}>
        <View style={styles.searchWrap}>
          <Icon name="search-2" rawSize={18} color="#9ca3af" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search settings..."
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
        <View style={styles.titleArea}>
          <Text size={28} color="#111827" style={styles.pageTitle}>Settings</Text>
        </View>

        <View style={styles.list}>
          <View style={styles.sectionCard}>
            <Text size={15} color="#111827" style={styles.cardTitle}>个人设置</Text>
            <TouchableOpacity style={styles.profileRow} activeOpacity={0.75}>
              <View style={styles.profileLeft}>
                <View style={styles.profileIconWrap}>
                  <Icon name="album" rawSize={16} color="#5b6474" />
                </View>
                <Text size={14} color="#111827" style={styles.profileLabel}>头像选择</Text>
              </View>
              <Icon name="chevron-right-2" rawSize={16} color="#9ca3af" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.profileRow} activeOpacity={0.75}>
              <View style={styles.profileLeft}>
                <View style={styles.profileIconWrap}>
                  <Icon name="menu" rawSize={16} color="#5b6474" />
                </View>
                <Text size={14} color="#111827" style={styles.profileLabel}>昵称编辑</Text>
              </View>
              <Icon name="chevron-right-2" rawSize={16} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          <View style={styles.sectionCard}>
            <Text size={15} color="#111827" style={styles.cardTitle}>音乐播放</Text>
            <Source />
          </View>

          <View style={styles.sectionCard}>
            <Text size={15} color="#111827" style={styles.cardTitle}>数据同步</Text>
            <Sync />
          </View>
        </View>

        {
          SHOW_ADVANCED_SWITCHES ? (
            <View style={styles.list}>
              {settingItems.map(item => (
                <View key={item.title} style={styles.item}>
                  <View style={styles.left}>
                    <View style={styles.iconBox}>
                      <Icon name={item.icon} rawSize={18} color="#7f0df2" />
                    </View>
                    <View style={styles.textWrap}>
                      <Text size={14} color="#111827" style={styles.itemTitle}>{item.title}</Text>
                      <Text size={11} color="#6b7280">{item.subtitle}</Text>
                    </View>
                  </View>
                  <Switch value={item.enabled} trackColor={{ false: '#d1d5db', true: '#c4b5fd' }} thumbColor={item.enabled ? '#7f0df2' : '#f9fafb'} />
                </View>
              ))}
            </View>
          ) : null
        }
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
    paddingBottom: 18,
  },
  scroll: {
    flex: 1,
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
  titleArea: {
    paddingHorizontal: 16,
    marginBottom: 14,
    alignItems: 'center',
  },
  pageTitle: {
    fontWeight: '700',
    textAlign: 'center',
  },
  list: {
    paddingHorizontal: 16,
  },
  sectionCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f1f1f3',
    backgroundColor: '#ffffff',
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  cardTitle: {
    fontWeight: '700',
    marginBottom: 10,
  },
  profileRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  profileLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  profileLabel: {
    fontWeight: '500',
  },
  item: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f1f1f3',
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 8,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f3e8ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    marginLeft: 10,
    flex: 1,
  },
  itemTitle: {
    fontWeight: '600',
    marginBottom: 2,
  },
})
