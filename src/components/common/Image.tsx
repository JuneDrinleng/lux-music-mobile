/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

import { createStyle } from '@/utils/tools'
import { cacheImageUri, forgetCachedImageUri, peekCachedImageUri, pinImageUrl, resetImageCache } from '@/utils/imageCache'
import { COVER_FADE_MS, COVER_PLACEHOLDER_COLOR, coverPresentation, nextCoverUri } from '@/utils/imagePresentation'
import { useLuxTheme } from '@/theme/LuxTheme'
import { type ComponentProps, memo, useCallback, useEffect, useRef, useState } from 'react'
import { Animated, Easing, View, type ViewProps, Image as _Image, StyleSheet, type ImageLoadEventData, type NativeSyntheticEvent } from 'react-native'

export type OnLoadEvent = NativeSyntheticEvent<ImageLoadEventData>

export interface ImageProps extends ViewProps {
  style: ComponentProps<typeof _Image>['style']
  url?: string | number | null
  cache?: boolean
  resizeMode?: ComponentProps<typeof _Image>['resizeMode']
  blurRadius?: number
  showFallback?: boolean
  /** Keep this file out of ordinary cache eviction. Does not change layout. */
  cachePin?: boolean
  onError?: (url: string | number) => void
}

export const defaultHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36',
}
const MAX_IMAGE_RETRY = 3

const getRawUri = (url?: string | number | null) => {
  if (typeof url == 'number') return _Image.resolveAssetSource(url).uri
  if (!url) return ''
  return url.startsWith('/') ? `file://${url}` : url
}

const appendImageRetryToken = (uri: string, retryIndex: number) => {
  const hashIndex = uri.indexOf('#')
  const baseUri = hashIndex < 0 ? uri : uri.substring(0, hashIndex)
  const hash = hashIndex < 0 ? '' : uri.substring(hashIndex)
  const separator = baseUri.includes('?') ? '&' : '?'
  return `${baseUri}${separator}lx_retry=${retryIndex}${hash}`
}

const isRemoteUri = (uri: string | null) => Boolean(uri && /^https?:\/\//i.test(uri))

const Image = memo(({ url, cache, resizeMode = 'cover', blurRadius, showFallback = true, cachePin = false, style, onError, nativeID }: ImageProps) => {
  const { colors } = useLuxTheme()
  const placeholderStyle = [styles.placeholder, { backgroundColor: colors.surface.placeholder }]
  const rawUri = getRawUri(url)
  const shouldUseLocalCache = cache !== false && /^https?:\/\//i.test(rawUri)
  const initialPeek = shouldUseLocalCache ? peekCachedImageUri(rawUri) : null
  const initialPresentation = coverPresentation({
    rawUri,
    cacheEnabled: shouldUseLocalCache,
    peekedFileUri: initialPeek,
  })
  const [sourceUri, setSourceUri] = useState<string | null>(initialPresentation.uri)
  const [isLoaded, setLoaded] = useState(initialPresentation.loaded || !showFallback)
  const [isError, setError] = useState(false)
  const [retryIndex, setRetryIndex] = useState(0)
  const [fadeIn, setFadeIn] = useState(initialPresentation.fadeIn && showFallback && !initialPresentation.loaded)
  const opacity = useRef(new Animated.Value((initialPresentation.loaded || !showFallback) ? 1 : 0)).current
  const requestIdRef = useRef(0)

  const applyPresentation = useCallback((presentation: ReturnType<typeof coverPresentation>, nextFade: boolean) => {
    setSourceUri(presentation.uri)
    setLoaded(presentation.loaded || !showFallback)
    setFadeIn(nextFade && showFallback && !presentation.loaded)
    opacity.setValue((presentation.loaded || !showFallback) ? 1 : 0)
  }, [opacity, showFallback])

  const handleLoad = useCallback(() => {
    setLoaded(true)
    setError(false)
  }, [])

  const handleError = useCallback(() => {
    setLoaded(false)
    if (showFallback) opacity.setValue(0)
    if (retryIndex < MAX_IMAGE_RETRY) {
      if (shouldUseLocalCache && sourceUri && rawUri && sourceUri != rawUri && !isRemoteUri(sourceUri)) {
        forgetCachedImageUri(rawUri)
        setSourceUri(rawUri)
        setFadeIn(showFallback)
        setRetryIndex(retryIndex + 1)
        return
      }
      setFadeIn(showFallback)
      setRetryIndex(retryIndex + 1)
      return
    }
    setError(true)
    if (url != null && url !== '') onError?.(url)
  }, [onError, opacity, rawUri, retryIndex, showFallback, shouldUseLocalCache, sourceUri, url])

  useEffect(() => {
    const requestId = ++requestIdRef.current
    setError(false)
    setRetryIndex(0)
    const peeked = shouldUseLocalCache ? peekCachedImageUri(rawUri) : null
    const presentation = coverPresentation({
      rawUri,
      cacheEnabled: shouldUseLocalCache,
      peekedFileUri: peeked,
    })
    applyPresentation(presentation, presentation.fadeIn)
    if (cachePin && shouldUseLocalCache && rawUri) pinImageUrl(rawUri)
    if (!presentation.waitForDownload || !rawUri) return
    let canceled = false
    void cacheImageUri(rawUri, { pin: cachePin }).then((fileUri) => {
      if (canceled || requestId != requestIdRef.current) return
      setSourceUri((current) => {
        const next = nextCoverUri(current, fileUri, rawUri)
        return next
      })
      setFadeIn(showFallback)
      setLoaded(!showFallback)
      if (showFallback) opacity.setValue(0)
    })
    return () => {
      canceled = true
    }
  }, [applyPresentation, cachePin, opacity, rawUri, shouldUseLocalCache, showFallback])

  useEffect(() => {
    if (!isLoaded) return
    if (!fadeIn) {
      opacity.setValue(1)
      return
    }
    const animation = Animated.timing(opacity, {
      toValue: 1,
      duration: COVER_FADE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    })
    animation.start()
    return () => {
      animation.stop()
    }
  }, [fadeIn, isLoaded, opacity, sourceUri])

  if (!rawUri || isError) {
    if (!showFallback) return <View style={style} nativeID={nativeID} />
    return <View style={[placeholderStyle, style]} nativeID={nativeID} />
  }

  const remoteSource = isRemoteUri(sourceUri)
  const displayUri = sourceUri && remoteSource && retryIndex > 0
    ? appendImageRetryToken(sourceUri, retryIndex)
    : sourceUri
  const plateStyle = showFallback ? placeholderStyle : null

  return (
    <View style={[styles.imageWrap, style, plateStyle]}>
      {displayUri
        ? <Animated.View pointerEvents="none" style={[styles.imageLayer, { opacity }]}>
            <_Image
              key={displayUri}
              style={styles.imageFill}
              source={{
                uri: displayUri,
                headers: remoteSource ? defaultHeaders : undefined,
                cache: remoteSource ? (retryIndex > 0 || cache === false ? 'reload' : 'force-cache') : undefined,
              }}
              onError={handleError}
              onLoad={handleLoad}
              resizeMode={resizeMode}
              blurRadius={blurRadius}
              nativeID={nativeID}
            />
          </Animated.View>
        : null}
    </View>
  )
}, (prevProps, nextProps) => {
  return prevProps.url == nextProps.url &&
    prevProps.style == nextProps.style &&
    prevProps.nativeID == nextProps.nativeID &&
    prevProps.cache == nextProps.cache &&
    prevProps.resizeMode == nextProps.resizeMode &&
    prevProps.blurRadius == nextProps.blurRadius &&
    prevProps.showFallback == nextProps.showFallback &&
    prevProps.cachePin == nextProps.cachePin
})

export const getSize = (uri: string, success: (width: number, height: number) => void, failure?: (error: any) => void) => {
  _Image.getSize(uri, success, failure)
}
export const clearMemoryCache = async() => {
  await resetImageCache()
}
export default Image

const styles = createStyle({
  placeholder: {
    backgroundColor: COVER_PLACEHOLDER_COLOR,
  },
  imageWrap: {
    overflow: 'hidden',
  },
  imageLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  imageFill: {
    width: '100%',
    height: '100%',
  },
})
