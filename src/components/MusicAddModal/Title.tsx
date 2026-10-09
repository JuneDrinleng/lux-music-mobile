/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { View } from 'react-native'

import Image from '@/components/common/Image'
import Text from '@/components/common/Text'
import { SourceTag } from '@/components/magazine'
import { useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { pickMusicCover } from '@/utils/musicCover'

/** Song subject block for MagazineSheet B (26B) — cover 48 + name + source + singer/album. */
export default ({ musicInfo }: {
  musicInfo: LX.Music.MusicInfo
  isMove?: boolean
}) => {
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const secondaryLine = [musicInfo.singer, musicInfo.meta.albumName].filter(Boolean).join(' / ')
  const cover = pickMusicCover(musicInfo) ?? musicInfo.meta.picUrl ?? null
  const sourceLabel = musicInfo.source !== 'local' ? musicInfo.source.toUpperCase() : ''

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{
        width: 48,
        height: 48,
        borderRadius: 6,
        overflow: 'hidden',
        backgroundColor: r.placeholder,
      }}>
        {cover
          ? <Image url={cover} style={{ width: 48, height: 48, borderRadius: 6 }} />
          : null}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text size={17} color={r.ink} style={{ fontWeight: '800' }} numberOfLines={2}>{musicInfo.name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
          {sourceLabel
            ? <SourceTag source={musicInfo.source} label={sourceLabel} />
            : null}
          {secondaryLine
            ? <Text size={12} color={r.muted} numberOfLines={1} style={{ flexShrink: 1 }}>{secondaryLine}</Text>
            : null}
        </View>
      </View>
    </View>
  )
}
