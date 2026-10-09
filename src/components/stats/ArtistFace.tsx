/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { useEffect, useMemo, useState } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'

import Image from '@/components/common/Image'
import Text from '@/components/common/Text'
import { useLuxTheme } from '@/theme/LuxTheme'
import { lookupArtistAvatar } from '@/utils/playHistory/artistAvatar'

const toneIndexForName = (name: string, count: number) => {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash + name.charCodeAt(i) * (i + 1)) % 997
  return count > 0 ? hash % count : 0
}

const initialGlyph = (name: string) => {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  return trimmed[0]
}

export const ArtistFace = ({
  name,
  fallback,
  size,
  style,
  imageStyle,
  toneIndex,
}: {
  name: string
  fallback?: string
  size: number
  style?: StyleProp<ViewStyle>
  imageStyle?: StyleProp<ViewStyle>
  /** Optional override; defaults to a stable hash of `name` into playlistCovers. */
  toneIndex?: number
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

  const tone = useMemo(() => {
    const covers = colors.playlistCovers
    const index = toneIndex ?? toneIndexForName(name, covers.length)
    return covers[index % covers.length]
  }, [colors.playlistCovers, name, toneIndex])

  const src = url ?? fallback
  const glyphSize = Math.max(14, Math.round(size * 0.42))

  return (
    <View style={[{
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: tone.accent,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    }, style]}>
      {src
        ? <Image style={[{ width: size, height: size, borderRadius: size / 2 }, imageStyle]} url={src} />
        : (
          <Text
            size={glyphSize}
            color={colors.bg.plain}
            style={{ fontWeight: '800', includeFontPadding: false }}
          >{initialGlyph(name)}</Text>
          )}
    </View>
  )
}
