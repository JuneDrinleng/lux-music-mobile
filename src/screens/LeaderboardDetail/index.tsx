import { useEffect, useMemo, useRef } from 'react'
import { TouchableOpacity, View } from 'react-native'
import PageContent from '@/components/PageContent'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { pop } from '@/navigation'
import MusicList, { type MusicListType } from '@/screens/Home/Views/Leaderboard/MusicList'
import { scaleSizeH } from '@/utils/pixelRatio'
import { BorderWidths } from '@/theme'


interface Props {
  componentId: string
  source: LX.OnlineSource
  boardId: string
  boardName?: string
}

const HEADER_HEIGHT = scaleSizeH(46)

export default ({ componentId, source, boardId, boardName }: Props) => {
  const theme = useTheme()
  const t = useI18n()
  const listRef = useRef<MusicListType>(null)

  useEffect(() => {
    listRef.current?.loadList(source, boardId)
  }, [source, boardId])

  const title = useMemo(() => boardName || t('nav_top'), [boardName, t])

  return (
    <PageContent>
      <View style={{ ...styles.header, borderBottomColor: theme['c-border-background'], height: HEADER_HEIGHT }}>
        <TouchableOpacity onPress={() => { void pop(componentId) }} style={styles.backBtn}>
          <Icon name="chevron-left" size={18} color={theme['c-font']} />
        </TouchableOpacity>
        <View style={styles.titleWrap}>
          <Text size={16} numberOfLines={1}>{title}</Text>
          <Text size={11} color={theme['c-500']}>{source}</Text>
        </View>
      </View>
      <MusicList ref={listRef} />
    </PageContent>
  )
}

const styles = createStyle({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    borderBottomWidth: BorderWidths.normal,
  },
  backBtn: {
    width: 36,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    flexGrow: 1,
    flexShrink: 1,
    paddingLeft: 4,
    paddingRight: 6,
  },
})
