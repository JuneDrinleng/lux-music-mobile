import { memo } from 'react'
import { View, TouchableOpacity, Image as RNImage } from 'react-native'

import { Icon } from '@/components/common/Icon'
import { pop } from '@/navigation'
import shareIcon from '../../../../assets/img/share.png'
import StatusBar from '@/components/common/StatusBar'
import { createStyle } from '@/utils/tools'
import commonState from '@/store/common/state'
import { useStatusbarHeight } from '@/store/common/hook'

export default memo(({ embedded, onBack, onShare }: {
  embedded?: boolean
  onBack?: () => void
  onShare?: () => void
}) => {
  const statusBarHeight = useStatusbarHeight()

  const back = () => {
    if (onBack) {
      onBack()
    } else {
      void pop(commonState.componentIds.comment!)
    }
  }

  return (
    <View style={{ paddingTop: statusBarHeight + 8 }}>
      {!embedded && <StatusBar />}
      <View style={styles.container}>
        <TouchableOpacity style={styles.headerBtn} activeOpacity={0.7} onPress={back}>
          <Icon name="chevron-left" rawSize={24} color="#0f172a" style={styles.backIcon} />
        </TouchableOpacity>
        <View style={styles.headerCenter} />
        <TouchableOpacity style={styles.headerBtn} activeOpacity={0.7} onPress={onShare}>
          <RNImage source={shareIcon} style={styles.shareIcon} />
        </TouchableOpacity>
      </View>
    </View>
  )
})

const styles = createStyle({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    transform: [{ rotate: '-90deg' }],
  },
  shareIcon: {
    width: 20,
    height: 20,
    tintColor: '#0f172a',
  },
  headerCenter: {
    flex: 1,
  },
})
