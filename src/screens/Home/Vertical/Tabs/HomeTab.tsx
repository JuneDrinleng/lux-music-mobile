import { ScrollView, TextInput, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import Image from '@/components/common/Image'
import { createStyle } from '@/utils/tools'
import { useStatusbarHeight } from '@/store/common/hook'

const recommended = [
  {
    title: 'Midnight Vibes',
    subtitle: 'Personalized Mix',
    pic: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBOg_-DGAM8IjBhPZz5Qror_lLdmn7GZvz58gXSdqT5FwAKbnx7mivvewtGW17bsSedeRSq34wgtvDtqd4ooT540rS8xx8MZ6_vHzXpXjThwwkI8wm8mikGMTlHzFZYG11ClkWZZyuInXQoNlUBfg3-ekMgc7Ca0u7k2Y3SoN-Je_X_BMaPY5Z0HCq9UAZI8xtgjTeV__b0XmblucfyzdYTwTxdZtJYfOdoAsazxOVH6IssKfFxe7dA1meDt2rH_nxtQT9taM4naUo',
  },
  {
    title: 'Electronic Rush',
    subtitle: 'Modern Synth',
    pic: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDYwv_afvH8CkKd9zzH5WhtJMfuuVkZpGGjP734QPRZTqW1iozx4m828mMrcrXqLgWty_Zk6uU0Zu6omXMR6VDlOAe22KYMVUtSKa9_AVOUw1Eh2HBB00vtKy0oagEBCj5pZmiOdDiPMo4qZOQjnaizzMwpxp7dHYdn8DzD6lP3yz15_LL6XvrApJwnbWvLZ9QMSdjG-L46jOTsBVjbaWWR3Zm_Oe0Tax6mRWMSno-d3R3-tDyqP_s9INvAIZwONtDZX8tYuJcS3Vs',
  },
  {
    title: 'Lofi Rainy Day',
    subtitle: 'Chill & Study',
    pic: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBHWk2O_b_gV9fmua4DZAPYZnnJ5qMnD92U3u3p0WnTKJN74zz1ZnSQP4pQwgfVnIO_U3JEO0uno5rsz2lkA4ffNIRCODqm6AxdbiDZifmivk6OEmweyp8IVkIIQYCmko4xvjqoGUYHcKOjwyv3od10iJj7jdC-Z5C2tyCAULP7isA9ziMutwI7Xh_e9V92PtM70NcnVXb8N3sfjK4AEOjoKYBVaCeTnW1aiibx3sM4hRM7L7BwDvp19C2b7SKh8QENTbw3Rp2kehw',
  },
  {
    title: 'Euphoria',
    subtitle: 'Trending Now',
    pic: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA6Eo3UYRNNPQe_EENtiXt0EyM7A1QDuVvcsueh6RjrqZ_72scwn98T52bLcpIE0FdRGEMf9B1c5n45EaXoYGCV2xkPvwdPdeT6zPzfqqeckOUVAwVlZMBuimPkUmIgQ4_dHD8QZBHdawUHvOvv2g8UmTdm2iYK_4oRoxEc-hvrVDVGTthLxHXfUOOlowvgQFEWOS2E85ACiNuO8mN6DvUXX8Ye54aEYeLZ2myi10boIpq4mTUBrg_Zm9fAi2eh1y3RzCfVuqKavaU',
  },
]

const madeForYou = [
  {
    title: 'Daily Mix 1',
    pic: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBDKehyVhypR73rE4wutCvAiUzFNhs94MxixsUdydtkCAlaG-kuxNfQUle34gTFATfwoawiAPYxdGEuJ_mnst3I3QuBZHnyRClI9QuvK_Qcsc86MY0iY-YA3_JUmE9KOTg2vAGAXJE2ETGpKJxabcN-iIoJEapsnhNFZxETESfaxdi7baBLFfoZHfFM42-FOL5kyhZp3YWGPBVbkTS42_FM-ad0fiYgj0a_BAqQw4atOlPsHLhT-u_psoKSPr0rJcUy5liD3YFMyVI',
  },
  {
    title: 'Daily Mix 2',
    pic: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAe-POQ0GNMwBI1Gv8bZJqfE7X3VMVSybNAMVLL0E0QcNGrUCyWD7eFpRMBS4oie185bXn05sOM3s1NImgiZoB2WP9cEcO0D4foHV7fRw7McnkraAgXfmeyLk9f2Etdovsv_Smv8eU67uSz1r-M48f5pbesRL5f_KIn2HZoinIn53aTbnauAKzLqE2HNcMgzh1OKbiPackUNPlyE_vnirG2C_buNa1p1mq2AiFj5J435fbLn5FXmJCZIs_VDJmZdaRZTsevjt6GE54',
  },
  {
    title: 'Daily Mix 3',
    pic: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCi0WNK6dp0GoKAspAJbmH9ggFostieSlhMdLKsJy_0BbghDfKOAio7qreIKEGTjnXfLeEUQluSpLp3FSFjjrkGv0YpRuw8e6ttHoHOUwiXRtzFv5fzGHWOTSgMouPUlRjZODgcBpLI7H7m03XAOZaqjQl6Mjf4AGICo8Eq9nYg_LlVZkX_1eHZR-VouzDD0yCIonVn5JWEERY8ixTpmkanW9vHOIqT_0LUTQ1lQ5NiBDtq0v61AyZnMOJgGHAnGlTBjj03Yw_9Cto',
  },
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
            placeholder="Search songs, artists, albums..."
            placeholderTextColor="#9ca3af"
          />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: headerHeight }]}
        showsVerticalScrollIndicator={false}
        bounces={false}
        alwaysBounceVertical={false}
        overScrollMode="never"
      >
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text size={24} color="#111827" style={styles.sectionTitle}>Recommended</Text>
            <TouchableOpacity activeOpacity={0.8}>
              <Text size={13} color="#7f0df2" style={styles.sectionLink}>See All</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.grid}>
            {recommended.map(item => (
              <View key={item.title} style={styles.gridItem}>
                <View style={styles.card}>
                  <Image style={styles.gridImage} url={item.pic} />
                </View>
                <Text size={13} color="#111827" numberOfLines={1} style={styles.itemTitle}>{item.title}</Text>
                <Text size={11} color="#6b7280" numberOfLines={1}>{item.subtitle}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text size={20} color="#111827" style={styles.sectionTitle}>Made For You</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mixRow}>
            {madeForYou.map(item => (
              <View key={item.title} style={styles.mixItem}>
                <View style={styles.mixImageWrap}>
                  <Image style={styles.mixImage} url={item.pic} />
                </View>
                <Text size={11} color="#4b5563" style={styles.mixText}>{item.title}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  content: {
    paddingBottom: 0,
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
    backgroundColor: '#f9f9f9',
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
  section: {
    marginTop: 12,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: {
    fontWeight: '700',
  },
  sectionLink: {
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridItem: {
    width: '48%',
    marginBottom: 12,
  },
  card: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    marginBottom: 8,
  },
  gridImage: {
    width: '100%',
    aspectRatio: 1,
  },
  itemTitle: {
    fontWeight: '600',
    marginBottom: 2,
  },
  mixRow: {
    paddingTop: 10,
    paddingBottom: 2,
  },
  mixItem: {
    width: 104,
    marginRight: 14,
    alignItems: 'center',
  },
  mixImageWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: '#f1e8ff',
    backgroundColor: '#ffffff',
    padding: 3,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    marginBottom: 6,
  },
  mixImage: {
    width: '100%',
    height: '100%',
    borderRadius: 46,
  },
  mixText: {
    fontWeight: '500',
    textAlign: 'center',
  },
})
