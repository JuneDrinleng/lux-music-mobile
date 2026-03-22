import { memo } from 'react'
import { TouchableOpacity, View } from 'react-native'
import { Icon } from '@/components/common/Icon'
import { useNavActiveId } from '@/store/common/hook'
import { createStyle } from '@/utils/tools'
import { setNavActiveId } from '@/core/common'
import type { InitState } from '@/store/common/state'

const activeColor = '#111827'
const inactiveColor = '#9ca3af'

const tabs = [
  { id: 'nav_love', icon: 'album' },
  { id: 'nav_setting', icon: 'setting' },
] as const

type TabId = InitState['navActiveId']

const TabItem = ({ id, icon, active, compact = false, onPress }: {
  id: TabId
  icon: string
  active: boolean
  compact?: boolean
  onPress: (id: TabId) => void
}) => {
  return (
    <TouchableOpacity style={[styles.item, compact ? styles.itemCompact : null]} activeOpacity={0.8} onPress={() => { onPress(id) }}>
      <Icon name={icon} rawSize={compact ? 19 : 22} color={active ? activeColor : inactiveColor} />
    </TouchableOpacity>
  )
}

export default memo(({ bottomInset = 0, inCard = false }: { bottomInset?: number, inCard?: boolean }) => {
  const activeId = useNavActiveId()

  const handlePress = (id: TabId) => {
    if (activeId === id) return
    setNavActiveId(id)
  }

  const bottomPadding = inCard ? 4 : 10 + bottomInset

  return (
    <View style={[styles.container, inCard ? styles.containerInCard : null, { paddingBottom: bottomPadding }]}>
      {tabs.map(tab => (
        <TabItem
          key={tab.id}
          id={tab.id}
          icon={tab.icon}
          active={activeId === tab.id}
          compact={inCard}
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
    borderTopWidth: 0,
    borderTopColor: 'transparent',
    backgroundColor: 'transparent',
    overflow: 'visible',
    paddingTop: 6,
    paddingBottom: 10,
    paddingHorizontal: 6,
  },
  containerInCard: {
    borderTopWidth: 0,
    borderTopColor: 'transparent',
    paddingTop: 2,
    paddingHorizontal: 8,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    paddingVertical: 4,
  },
  itemCompact: {
    paddingVertical: 1,
  },
})
