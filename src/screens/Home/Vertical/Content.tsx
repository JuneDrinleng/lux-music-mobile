import { View } from 'react-native'
import Header from './Header'
import Main from './Main'
import { createStyle } from '@/utils/tools'

const Content = () => {
  return (
    <View style={styles.container}>
      <Header />
      <View style={styles.main}>
        <Main />
      </View>
    </View>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
  },
  main: {
    flex: 1,
  },
})

export default Content
