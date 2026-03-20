import { memo } from 'react'
import { TouchableOpacity, View } from 'react-native'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'
import { useI18n } from '@/lang'

export type LibraryTabId = 'playlists' | 'favorites' | 'downloads' | 'recent'

const TAB_ITEMS: Array<{ id: LibraryTabId, labelKey: string }> = [
  { id: 'playlists', labelKey: 'library_tab_playlists' },
  { id: 'favorites', labelKey: 'library_tab_favorites' },
  { id: 'downloads', labelKey: 'library_tab_downloads' },
  { id: 'recent', labelKey: 'library_tab_recent' },
]

export default memo(({ activeTab, onChange }: {
  activeTab: LibraryTabId
  onChange: (id: LibraryTabId) => void
}) => {
  const theme = useTheme()
  const t = useI18n()

  return (
    <View style={styles.container}>
      <View style={{ ...styles.segment, backgroundColor: theme['c-main-background'], borderColor: theme['c-border-background'] }}>
        {TAB_ITEMS.map(tab => {
          const active = tab.id === activeTab
          return (
            <TouchableOpacity
              key={tab.id}
              style={{
                ...styles.tab,
                backgroundColor: active ? theme['c-content-background'] : 'transparent',
                borderColor: active ? theme['c-border-background'] : 'transparent',
              }}
              onPress={() => { onChange(tab.id) }}
              activeOpacity={0.8}
            >
              <Text size={12} color={active ? theme['c-font'] : theme['c-font-label']}>
                {t(tab.labelKey)}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
})

const styles = createStyle({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  segment: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 999,
    padding: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
})
