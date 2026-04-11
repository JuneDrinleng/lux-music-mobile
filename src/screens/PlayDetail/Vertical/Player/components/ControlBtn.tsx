/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

import { TouchableOpacity, View } from 'react-native'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
// import { useIsPlay } from '@/store/player/hook'
import { playNext, playPrev, togglePlay } from '@/core/player/player'
import { useIsPlay } from '@/store/player/hook'
import { createStyle } from '@/utils/tools'
import { useWindowSize } from '@/utils/hooks'
import { BTN_WIDTH } from './MoreBtn/Btn'
import { useMemo } from 'react'

const PrevBtn = ({ size }: { size: number }) => {
  const theme = useTheme()
  const handlePlayPrev = () => {
    void playPrev()
  }
  return (
    <TouchableOpacity style={{ ...styles.cotrolBtn, ...styles.secondaryBtn, width: size, height: size, backgroundColor: theme['c-200'] }} activeOpacity={0.6} onPress={handlePlayPrev}>
      <Icon name='prevMusic' color={theme['c-font']} rawSize={size * 0.6} />
    </TouchableOpacity>
  )
}
const NextBtn = ({ size }: { size: number }) => {
  const theme = useTheme()
  const handlePlayNext = () => {
    void playNext()
  }
  return (
    <TouchableOpacity style={{ ...styles.cotrolBtn, ...styles.secondaryBtn, width: size, height: size, backgroundColor: theme['c-200'] }} activeOpacity={0.6} onPress={handlePlayNext}>
      <Icon name='nextMusic' color={theme['c-font']} rawSize={size * 0.6} />
    </TouchableOpacity>
  )
}

const TogglePlayBtn = ({ size }: { size: number }) => {
  const theme = useTheme()
  const isPlay = useIsPlay()
  return (
    <TouchableOpacity
      style={{
        ...styles.cotrolBtn,
        ...styles.primaryBtn,
        width: size,
        height: size,
        backgroundColor: theme['c-primary'],
        shadowColor: theme['c-primary'],
      }}
      activeOpacity={0.7}
      onPress={togglePlay}
    >
      <Icon name={isPlay ? 'pause' : 'play'} color={theme['c-primary-font']} rawSize={size * 0.6} />
    </TouchableOpacity>
  )
}

const MAX_SIZE = BTN_WIDTH * 1.6
const MIN_SIZE = BTN_WIDTH * 1.2

export default () => {
  const winSize = useWindowSize()
  const maxHeight = Math.max(winSize.height * 0.11, MIN_SIZE)
  const containerStyle = useMemo(() => {
    return {
      ...styles.conatiner,
      maxHeight,
    }
  }, [maxHeight])
  const size = Math.min(Math.max(winSize.width * 0.33 * global.lx.fontSize * 0.4, MIN_SIZE), MAX_SIZE, maxHeight)

  return (
    <View style={containerStyle}>
      <PrevBtn size={size} />
      <TogglePlayBtn size={size}/>
      <NextBtn size={size} />
    </View>
  )
}


const styles = createStyle({
  conatiner: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    flexGrow: 1,
    flexShrink: 1,
    paddingHorizontal: '6%',
    paddingVertical: 18,
    // backgroundColor: 'rgba(0, 0, 0, .1)',
  },
  cotrolBtn: {
    justifyContent: 'center',
    alignItems: 'center',

    // backgroundColor: '#ccc',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    borderRadius: 999,
  },
  primaryBtn: {
    shadowOpacity: 0.3,
  },
  secondaryBtn: {
    shadowOpacity: 0,
  },
})
