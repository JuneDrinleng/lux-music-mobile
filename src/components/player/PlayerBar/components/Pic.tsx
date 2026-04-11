/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

import { StyleSheet, TouchableOpacity, View } from 'react-native'
import { navigations } from '@/navigation'
import { usePlayerMusicInfo } from '@/store/player/hook'
import { scaleSizeH } from '@/utils/pixelRatio'
import commonState from '@/store/common/state'
import playerState from '@/store/player/state'
import { LIST_IDS, NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import Image from '@/components/common/Image'
import { useCallback } from 'react'
import { setLoadErrorPicUrl, setMusicInfo } from '@/core/player/playInfo'
import { useTheme } from '@/store/theme/hook'

const PIC_HEIGHT = scaleSizeH(46)

const styles = StyleSheet.create({
  ring: {
    width: PIC_HEIGHT + 6,
    height: PIC_HEIGHT + 6,
    borderRadius: (PIC_HEIGHT + 6) / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: PIC_HEIGHT,
    height: PIC_HEIGHT,
    borderRadius: PIC_HEIGHT / 2,
  },
})

export default ({ isHome }: { isHome: boolean }) => {
  const musicInfo = usePlayerMusicInfo()
  const theme = useTheme()
  const handlePress = () => {
    // console.log('')
    // console.log(playMusicInfo)
    if (!musicInfo.id) return
    navigations.pushPlayDetailScreen(commonState.componentIds.home!)

    // toast(global.i18n.t('play_detail_todo_tip'), 'long')
  }

  const handleLongPress = () => {
    if (!isHome) return
    const listId = playerState.playMusicInfo.listId
    if (!listId || listId == LIST_IDS.DOWNLOAD) return
    global.app_event.jumpListPosition()
  }

  const handleError = useCallback((url: string | number) => {
    setLoadErrorPicUrl(url as string)
    setMusicInfo({
      pic: null,
    })
  }, [])

  return (
    <TouchableOpacity onLongPress={handleLongPress} onPress={handlePress} activeOpacity={0.7} >
      <View style={[styles.ring, { borderColor: theme['c-primary-light-700-alpha-300'] }]}>
        <Image url={musicInfo.pic} nativeID={NAV_SHEAR_NATIVE_IDS.playDetail_pic} style={styles.image} onError={handleError} />
      </View>
    </TouchableOpacity>
  )
}


// const styles = StyleSheet.create({
//   playInfoImg: {

//   },
// })
