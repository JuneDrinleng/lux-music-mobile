import { memo } from 'react'
import { TouchableOpacity, View } from 'react-native'
import { useI18n } from '@/lang'
import { useNavActiveId } from '@/store/common/hook'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import { setNavActiveId } from '@/core/common'
import type { InitState } from '@/store/common/state'

const TAB_ITEMS = [
  { id: 'nav_search', icon: 'search-2' },
  { id: 'nav_love', icon: 'love' },
  { id: 'nav_setting', icon: 'setting' },
] as const

type TabId = InitState['navActiveId']

const TabItem = ({ id, icon, active, onPress }: {
  id: TabId
  icon: string
  active: boolean
  onPress: (id: TabId) => void
}) => {
  const theme = useTheme()
  const t = useI18n()

  return (
    <TouchableOpacity style={styles.item} onPress={() => { onPress(id) }}>
      <Icon
        name={icon}
        size={22}
        color={active ? theme['c-primary-font-active'] : theme['c-font-label']}
      />
      <Text
        style={styles.label}
        size={12}
        color={active ? theme['c-primary-font-active'] : theme['c-font-label']}
      >
        {t(id)}
      </Text>
    </TouchableOpacity>
  )
}

export default memo(() => {
  const theme = useTheme()
  const activeId = useNavActiveId()

  const handlePress = (id: TabId) => {
    if (id === activeId) return
    setNavActiveId(id)
  }

  return (
    <View style={{
      ...styles.container,
      backgroundColor: theme['c-main-background'],
      borderColor: theme['c-border-background'],
      shadowColor: '#000',
    }}>
      {TAB_ITEMS.map(tab => (
        <TabItem
          key={tab.id}
          id={tab.id}
          icon={tab.icon}
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
    borderWidth: 1,
    borderRadius: 18,
    marginHorizontal: 10,
    marginBottom: 8,
    paddingBottom: 10,
    paddingTop: 8,
    paddingHorizontal: 6,
    elevation: 6,
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  label: {
    marginTop: 2,
  },
})
