/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import { memo, useEffect, useMemo, useState } from 'react'
import { Image, StyleSheet, View } from 'react-native'
import { defaultHeaders } from '@/components/common/Image'
import { cacheImageUri, peekCachedImageUri } from '@/utils/imageCache'
import { sharedLuxStyles } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { rgbaHex } from '@/theme/luxColorMath'

export const FrostedCover = memo(({ uri }: { uri?: string }) => {
  const styles = useStyles()
  const remote = !!uri && /^https?:\/\//i.test(uri)
  const [resolved, setResolved] = useState<{ uri?: string, fileUri: string | null }>(() => ({
    uri, fileUri: remote ? peekCachedImageUri(uri) : null,
  }))
  const [failedUri, setFailedUri] = useState<string>()
  // Never render a previous cover while the next cache request is pending.
  const displayUri = remote
    ? (resolved.uri === uri ? resolved.fileUri : peekCachedImageUri(uri))
    : uri?.startsWith('/') ? `file://${uri}` : uri
  useEffect(() => {
    if (!remote || !uri) return
    let canceled = false
    void cacheImageUri(uri).then(fileUri => {
      if (!canceled) setResolved({ uri, fileUri })
    }).catch(() => {
      if (!canceled) setResolved({ uri, fileUri: null })
    })
    // Downloads belong to the shared cache; only cancel this consumer's update.
    return () => { canceled = true }
  }, [remote, uri])
  const source = useMemo(() => ({ uri: displayUri ?? '', headers: defaultHeaders }), [displayUri])
  const usable = !!displayUri && uri !== failedUri
  return (
    <View pointerEvents="none" style={styles.background}>
      {usable ? <>
        {/* Resize to the laid-out card before Android's bitmap blur; keep the v5B radius. */}
        <Image key={displayUri} source={source} blurRadius={14} resizeMode="cover" resizeMethod="resize" style={StyleSheet.absoluteFillObject}
          onError={() => { setFailedUri(uri) }} />
        <View style={styles.tint} />
      </> : null}
    </View>
  )
})
const useStyles = sharedLuxStyles(colors => {
  const r = magazineRoles(colors)
  return StyleSheet.create({
    background: { ...StyleSheet.absoluteFillObject, overflow: 'hidden', backgroundColor: r.placeholder },
    tint: { ...StyleSheet.absoluteFillObject, backgroundColor: rgbaHex(r.paper, 0.66) },
  })
})
