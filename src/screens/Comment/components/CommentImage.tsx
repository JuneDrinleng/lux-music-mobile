import { useEffect, useState } from 'react'
import { View } from 'react-native'
import Image, { getSize } from '@/components/common/Image'
import { scaleSizeH } from '@/utils/pixelRatio'

const MAX_IMAGE_HEIGHT = scaleSizeH(260)


export default ({ url, maxWidth }: { url: string, maxWidth: number }) => {
  const [wh, setWH] = useState({ width: 0, height: 0 })

  useEffect(() => {
    getSize(url, (realWidth, realHeight) => {
      let w = 0
      let h = 0

      if (w && !h) {
        h = realHeight * (w / realWidth)
      } else if (!w && h) {
        w = realWidth * (h / realHeight)
      } else {
        if (maxWidth && realWidth > maxWidth) {
          w = maxWidth
          h = realHeight * (w / realWidth)

          if (MAX_IMAGE_HEIGHT && h > MAX_IMAGE_HEIGHT) {
            w = realWidth * (MAX_IMAGE_HEIGHT / realHeight)
            h = MAX_IMAGE_HEIGHT
          }
        } else if (MAX_IMAGE_HEIGHT && realHeight > MAX_IMAGE_HEIGHT) {
          w = realWidth * (h / realHeight)
          h = MAX_IMAGE_HEIGHT
        }
      }
      setWH({ width: w || realWidth, height: h || realHeight })
    })
  }, [maxWidth, url])

  return (
    wh.width ? (
      <View style={{ height: wh.height, width: wh.width }}>
        <Image
          url={url}
          style={{ height: wh.height, width: wh.width }}
        />
      </View>
    ) : null
  )
}
