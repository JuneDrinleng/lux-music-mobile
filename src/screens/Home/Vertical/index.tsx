import { View } from 'react-native'
import Content from './Content'
import PlayerBar from '@/components/player/PlayerBar'
import BottomNav from './BottomNav'
import StatusBar from '@/components/common/StatusBar'
import useSystemGestureInsetBottom from '@/utils/hooks/useSystemGestureInsetBottom'
import { createStyle } from '@/utils/tools'

const styles = createStyle({
  container: {
    flex: 1,
  },
  bottomLayer: {
    zIndex: 21,
    elevation: 21,
    backgroundColor: 'transparent',
  },
})

export default () => {
  const bottomInset = useSystemGestureInsetBottom()

  return (
    <View style={styles.container}>
      <StatusBar />
      <Content />
      <View style={styles.bottomLayer}>
        <PlayerBar isHome systemGestureInsetBottom={bottomInset} />
        <BottomNav bottomInset={bottomInset} />
      </View>
    </View>
  )
}
