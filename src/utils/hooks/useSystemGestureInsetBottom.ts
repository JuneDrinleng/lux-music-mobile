import { useMemo } from 'react'
import { Dimensions, Platform } from 'react-native'
import { useStatusbarHeight } from '@/store/common/hook'

export default () => {
  const statusbarHeight = useStatusbarHeight()

  return useMemo(() => {
    const screenHeight = Dimensions.get('screen').height
    const windowHeight = Dimensions.get('window').height
    const extraInset = Math.max(0, screenHeight - windowHeight)
    if (!extraInset) return 0
    if (Platform.OS == 'android') return Math.max(0, extraInset - statusbarHeight)
    return extraInset
  }, [statusbarHeight])
}
