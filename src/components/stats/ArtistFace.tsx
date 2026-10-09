/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { useEffect, useState } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'

import Image from '@/components/common/Image'
import { MdiIcon } from '@/components/common/MdiIcon'
import { useLuxTheme } from '@/theme/LuxTheme'
import { lookupArtistAvatar } from '@/utils/playHistory/artistAvatar'

export const ArtistFace = ({
  name,
  fallback,
  size,
  style,
  imageStyle,
}: {
  name: string
  fallback?: string
  size: number
  style?: StyleProp<ViewStyle>
  imageStyle?: StyleProp<ViewStyle>
}) => {
  const { colors } = useLuxTheme()
  const [url, setUrl] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    let alive = true
    void lookupArtistAvatar(name).then(found => {
      if (alive) setUrl(found)
    })
    return () => { alive = false }
  }, [name])
  const src = url ?? fallback
  return (
    <View style={[{
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: colors.surface.avatar,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    }, style]}>
      {src
        ? <Image style={[{ width: size, height: size, borderRadius: size / 2 }, imageStyle]} url={src} />
        : <MdiIcon name="account" size={Math.round(size * 0.48)} color={colors.ink.quiet} />}
    </View>
  )
}
