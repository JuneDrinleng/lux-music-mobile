import { View } from 'react-native'
import Content from './Content'
import PlayerBar from '@/components/player/PlayerBar'
import BottomNav from './BottomNav'
import PlayQueueSheet from './PlayQueueSheet'
import StatusBar from '@/components/common/StatusBar'
import useSystemGestureInsetBottom from '@/utils/hooks/useSystemGestureInsetBottom'
import { createStyle } from '@/utils/tools'
import { useComponentIds } from '@/store/common/hook'

const styles = createStyle({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  bottomLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 21,
    elevation: 21,
    backgroundColor: 'transparent',
  },
  playerWrap: {
    marginBottom: 6,
  },
  navShell: {
    backgroundColor: 'transparent',
    overflow: 'visible',
    shadowColor: '#000000',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
})

export default () => {
  const bottomInset = useSystemGestureInsetBottom()
  const componentIds = useComponentIds()

  return (
    <View style={styles.container}>
      <StatusBar />
      <Content />
      <View style={styles.bottomLayer} pointerEvents="box-none">
        <View style={styles.playerWrap}>
          <PlayerBar isHome systemGestureInsetBottom={bottomInset} />
        </View>
        <View style={styles.navShell}>
          <BottomNav bottomInset={bottomInset} />
        </View>
      </View>
      <PlayQueueSheet systemGestureInsetBottom={bottomInset} enabled={!componentIds.playDetail} />
    </View>
  )
}
