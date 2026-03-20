import { memo } from 'react'
import { TouchableOpacity, View } from 'react-native'
import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import { useNavActiveId } from '@/store/common/hook'
import { createStyle } from '@/utils/tools'
import { setNavActiveId } from '@/core/common'
import type { InitState } from '@/store/common/state'

const activeColor = '#7f0df2'
const inactiveColor = '#9ca3af'

const tabs = [
  { id: 'nav_love', icon: 'album', label: 'Me' },
  { id: 'nav_setting', icon: 'setting', label: 'Settings' },
] as const

type TabId = InitState['navActiveId']

const TabItem = ({ id, icon, label, active, onPress }: {
  id: TabId
  icon: string
  label: string
  active: boolean
  onPress: (id: TabId) => void
}) => {
  return (
    <TouchableOpacity style={styles.item} activeOpacity={0.8} onPress={() => { onPress(id) }}>
      <Icon name={icon} rawSize={22} color={active ? activeColor : inactiveColor} />
      <Text size={10} color={active ? activeColor : inactiveColor} style={active ? styles.activeLabel : styles.label}>
        {label}
      </Text>
    </TouchableOpacity>
  )
}

export default memo(() => {
  const activeId = useNavActiveId()

  const handlePress = (id: TabId) => {
    if (activeId === id) return
    setNavActiveId(id)
  }

  return (
    <View style={styles.container}>
      {tabs.map(tab => (
        <TabItem
          key={tab.id}
          id={tab.id}
          icon={tab.icon}
          label={tab.label}
          active={activeId === tab.id}
          onPress={handlePress}
        />
      ))}
    </View>
  )
})

const styles = createStyle({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#f1f1f3',
    backgroundColor: '#ffffff',
    paddingTop: 6,
    paddingBottom: 10,
    paddingHorizontal: 6,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  label: {
    marginTop: 2,
    fontWeight: '500',
  },
  activeLabel: {
    marginTop: 2,
    fontWeight: '700',
  },
})
