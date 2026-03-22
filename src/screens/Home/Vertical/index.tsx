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
    backgroundColor: '#f8f9fa',
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
  bottomCard: {
    marginHorizontal: 12,
    marginBottom: 6,
    borderRadius: 18,
    backgroundColor: 'transparent',
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  bottomCardInner: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e8e8ec',
    backgroundColor: 'rgba(255,255,255,0.95)',
    overflow: 'hidden',
  },
})

export default () => {
  const bottomInset = useSystemGestureInsetBottom()
  const componentIds = useComponentIds()

  return (
    <View style={styles.container}>
      <StatusBar />
      <Content />
      <View style={[styles.bottomLayer, bottomInset ? { paddingBottom: bottomInset } : null]} pointerEvents="box-none">
        <View style={styles.bottomCard}>
          <View style={styles.bottomCardInner}>
            <PlayerBar isHome inCard systemGestureInsetBottom={bottomInset} />
            <BottomNav inCard />
          </View>
        </View>
      </View>
      <PlayQueueSheet systemGestureInsetBottom={bottomInset} enabled={!componentIds.playDetail} />
    </View>
  )
}
