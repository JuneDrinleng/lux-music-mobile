/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

import { View } from 'react-native'
import Aside from './Aside'
import PlayerBar from '@/components/player/PlayerBar'
import StatusBar from '@/components/common/StatusBar'
import Header from './Header'
import Main from './Main'
import { createStyle } from '@/utils/tools'
import useSystemGestureInsetBottom from '@/utils/hooks/useSystemGestureInsetBottom'

const styles = createStyle({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  content: {
    flex: 1,
    overflow: 'hidden',
  },
})

export default () => {
  const bottomInset = useSystemGestureInsetBottom()

  return (
    <>
      <StatusBar />
      <View style={styles.container}>
        <Aside />
        <View style={styles.content}>
          <Header />
          <Main />
          <View style={bottomInset ? { paddingBottom: bottomInset } : null}>
            <PlayerBar isHome systemGestureInsetBottom={bottomInset} />
          </View>
        </View>
      </View>
    </>
  )
}
