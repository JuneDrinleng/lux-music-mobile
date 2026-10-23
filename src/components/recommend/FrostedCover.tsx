/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import { useState } from 'react'
import { Image, StyleSheet, View } from 'react-native'
import { defaultHeaders } from '@/components/common/Image'
import { useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { rgbaHex } from '@/theme/luxColorMath'

export const FrostedCover = ({ uri }: { uri?: string }) => {
  const r = magazineRoles(useLuxTheme().colors)
  const [failedUri, setFailedUri] = useState<string>()
  const usable = !!uri && uri !== failedUri
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { overflow: 'hidden', backgroundColor: r.placeholder }]}>
      {usable ? <>
        {/* Same native image blur + source headers as PageContent, including Android. */}
        <Image source={{ uri, headers: defaultHeaders }} blurRadius={14} resizeMode="cover" style={StyleSheet.absoluteFillObject}
          onError={() => { setFailedUri(uri) }} />
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: rgbaHex(r.paper, 0.66) }]} />
      </> : null}
    </View>
  )
}
