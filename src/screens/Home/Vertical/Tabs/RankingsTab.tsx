/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

// Lux Proprietary
import { ScrollView, TextInput, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import Image from '@/components/common/Image'
import { createStyle } from '@/utils/tools'
import { useStatusbarHeight } from '@/store/common/hook'

const categories = [
  { name: 'Top 50 - Global', active: true },
  { name: 'Trending Now', active: false },
  { name: 'New Releases', active: false },
  { name: 'Genre: Electronic', active: false },
]

const rankingList = [
  {
    rank: 1,
    title: 'Starboy',
    subtitle: 'The Weeknd, Daft Punk',
    pic: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBLzNXx-pP3skEbhd31sIVvwdWmQm2Z7Zvr4zxm9v3cqPo8chBwkYhE-2Dh6j7dWPSdUocDnZhbLpBU9Q5tOiCGRgBFMPt0uAGAnFCi1mKgYGDbhAXczaR5lJxTaQGEHq25jZOg7K3EnQk1Xjw3qq6lib_JQfdmlScjs_UITWFCoTAfMPtQrJIdllCSeQaszovh6W-dOvX95IeK6M-A9A5lH_uSkwodU6rc6iZpibwD75W43SDr4UkNWtXoSmyIL7lPtkyj4NHw5vY',
  },
  {
    rank: 2,
    title: 'Midnight City',
    subtitle: "M83 - Hurry Up, We're Dreaming",
    pic: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDI1FWR6OVZL84EovUU68V5Ba06fggNDvTvLFWBJiWQMvHSpwcfgAf5nfNBlhgaYkqMV0bCDrI8g9Sl0Q_ZcKYUh30-qx2x_mz5_XO_UUAJlz32rrQRUuMsTvvndCiokB9RX7jkXzwWPWaqa2a-UgPpggZtj0Ac6gEMBhAJYtLJtVWNLLEHrok1fPxPsdTj0ezr9eJM28-RUuWtwt2GqmZvmvXsWHMv9q0chZYQE43CbQG0q73yE0QtIMhINHYLI0_cpHt1K3AJS2E',
  },
  {
    rank: 3,
    title: 'Blinding Lights',
    subtitle: 'The Weeknd',
    pic: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBogp72uJMQjGApFuc4_3Nl1kB3yjl5Aeqc5-kLlAEHOKyxiDPfbYFeyB5kOLpM5T-x95AbERWSYGGb91esJxYbUcOQgd1Yu7LAhWiAW4C8eNEwIFxxUn00UQjVY19FEY6MuvTgLEWQeYcIvnGEG-DJPy_EXF7itIWImCpo96G2jKGA8nQcn4Y7k1reYs94T54jwsSL5h7x8TRhwCMZzcTtMknxvzoLuQMofN50XgS9cyxWPp0k0zDrBu04Fr3eoCJeBc2kybThnCY',
  },
  {
    rank: 4,
    title: 'Nightcall',
    subtitle: 'Kavinsky',
    pic: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDJ0V7s1K84XmCUURvjOAUvCZ-3w0ptbL-cIqFOj5QgQ6HKfw1U-j_8yOhEc8TN50zxiowzkJAH7iEcd40xXTJH0SL_VZQ6bto4lPXUMnkRipNV803fGJQNWW8eBWWgiWBEb_E4q4Dz3NudpyO0sQ3Lgsiwj3onEeO7Cc4kH6kjPtZD4pwJBwGQffa6UlxCLlVDqquiC2JSSONCkTIOxlMQ5ELVUZpD5bTTagHSzgtpC5Hmc61nvJysfjAmKXkoFuKK6bFkIg3SBOY',
  },
  {
    rank: 5,
    title: 'Levitating',
    subtitle: 'Dua Lipa',
    pic: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAJ6yPkI8TLXZIje2C1ekpSyLmFFZ6Ft_-j7aUUI5Lnx0w4FkCyqUSJcxFFJwNzj-XV4jF2rl38EiugCkpVayVSP2qkEoN8eYW4mgYD01l9o6fRjdUMhJ7AftXcFCFGUJaMxP4IPvNRX9IvccdPkPLQhVmjlPCwT5PPvKAehv4R4eE4O-IS9XL7N-d_BhK8g3FLttq4M7FDWb0fhqqhKWMReftIMYWZ3EhynR15VELKIZYfm-js3Emtc1l0hAYczxZbKrlWCm3lf7A',
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
        contentContainerStyle={[styles.content, { paddingTop: headerHeight + 12 }]}
        showsVerticalScrollIndicator={false}
        bounces={false}
        alwaysBounceVertical={false}
        overScrollMode="never"
      >
        <View style={styles.titleRow}>
          <Text size={30} color="#111827" style={styles.pageTitle}>Rankings</Text>
          <Text size={13} color="#111827" style={styles.pageTag}>Global</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
          {categories.map(item => (
            <TouchableOpacity
              key={item.name}
              activeOpacity={0.8}
              style={item.active ? styles.categoryActive : styles.category}
            >
              <Text size={12} color={item.active ? '#ffffff' : '#4b5563'} style={styles.categoryText}>
                {item.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.list}>
          {rankingList.map(item => (
            <View key={item.rank} style={styles.item}>
              <Text size={18} color={item.rank === 1 ? '#111827' : '#9ca3af'} style={styles.rank}>
                {item.rank}
              </Text>
              <Image style={styles.itemPic} url={item.pic} />
              <View style={styles.itemInfo}>
                <Text size={14} color="#111827" numberOfLines={1} style={styles.itemTitle}>{item.title}</Text>
                <Text size={11} color="#6b7280" numberOfLines={1}>{item.subtitle}</Text>
              </View>
              <TouchableOpacity style={styles.moreBtn} activeOpacity={0.8}>
                <Icon name="menu" rawSize={18} color="#9ca3af" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingHorizontal: 16,
  },
  pageTitle: {
    fontWeight: '700',
  },
  pageTag: {
    fontWeight: '600',
  },
  categoryRow: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  categoryActive: {
    backgroundColor: '#111827',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  category: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  categoryText: {
    fontWeight: '500',
  },
  list: {
    paddingHorizontal: 16,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#f1f1f3',
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  rank: {
    width: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginRight: 10,
  },
  itemPic: {
    width: 48,
    height: 48,
    borderRadius: 9,
  },
  itemInfo: {
    flex: 1,
    marginLeft: 10,
  },
  itemTitle: {
    fontWeight: '600',
    marginBottom: 2,
  },
  moreBtn: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
