/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

// Lux Proprietary
import { memo } from 'react'
import { FlatList, View } from 'react-native'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'
import { usePlayedList } from '@/store/player/hook'

export default memo(() => {
  const theme = useTheme()
  const playedList = usePlayedList()

  if (!playedList.length) {
    return (
      <View style={styles.empty}>
        <Text size={13} color={theme['c-500']}>暂无最近播放</Text>
      </View>
    )
  }

  return (
    <FlatList
      data={playedList}
      keyExtractor={(item) => item.musicInfo.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <View style={{ ...styles.item, borderBottomColor: theme['c-border-background'] }}>
          <Text size={14} numberOfLines={1}>{item.musicInfo.name}</Text>
          <Text size={12} color={theme['c-500']} numberOfLines={1}>{item.musicInfo.singer}</Text>
        </View>
      )}
    />
  )
})

const styles = createStyle({
  list: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  item: {
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
