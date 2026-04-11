/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

import { View } from 'react-native'
import Main from './Main'
import { createStyle } from '@/utils/tools'

const Content = () => {
  return (
    <View style={styles.container}>
      <Main />
    </View>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
  },
})

export default Content
