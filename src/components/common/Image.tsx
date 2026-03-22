import { BorderRadius } from '@/theme'
import { createStyle } from '@/utils/tools'
import { cacheImageUri, getCachedImageUri, peekCachedImageUri } from '@/utils/imageCache'
import { memo, useCallback, useEffect, useState } from 'react'
import { View, type ViewProps, Image as _Image, StyleSheet } from 'react-native'
import FastImage, { type FastImageProps } from '@d11/react-native-fast-image'
import loadFailPic from '../../../assets/img/loadfail.png'
export type { OnLoadEvent } from '@d11/react-native-fast-image'

export interface ImageProps extends ViewProps {
  style: FastImageProps['style']
  url?: string | number | null
  cache?: boolean
  resizeMode?: FastImageProps['resizeMode']
  blurRadius?: number
  showFallback?: boolean
  onError?: (url: string | number) => void
}


export const defaultHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36',
}
const getRawUri = (url?: string | number | null) => {
  if (typeof url == 'number') return _Image.resolveAssetSource(url).uri
  if (!url) return ''
  return url.startsWith('/') ? `file://${url}` : url
}

const EmptyPic = memo(({ style, nativeID }: { style: ImageProps['style'], nativeID: ImageProps['nativeID'] }) => {
  return (
    <View style={StyleSheet.compose(styles.emptyPicWrap, style)} nativeID={nativeID}>
      <_Image source={loadFailPic} style={styles.emptyPicImage} resizeMode="cover" />
    </View>
  )
})

const Image = memo(({ url, cache, resizeMode = FastImage.resizeMode.cover, blurRadius, showFallback = true, style, onError, nativeID }: ImageProps) => {
  const [isLoaded, setLoaded] = useState(false)
  const [isError, setError] = useState(false)
  const [cachedUriState, setCachedUriState] = useState<{ rawUri: string, cachedUri: string } | null>(null)
  const rawUri = getRawUri(url)
  const shouldUseLocalCache = cache !== false && /^https?:\/\//i.test(rawUri)
  const runtimeCachedUri = shouldUseLocalCache ? (peekCachedImageUri(rawUri) ?? '') : ''
  const cachedUri = (cachedUriState?.rawUri == rawUri ? cachedUriState.cachedUri : '') || runtimeCachedUri

  const handleLoad = useCallback(() => {
    setLoaded(true)
    setError(false)
  }, [])

  const handleError = useCallback(() => {
    setLoaded(false)
    setError(true)
    onError?.(url!)
  }, [onError, url])

  useEffect(() => {
    setLoaded(false)
    setError(false)
    if (!rawUri || !shouldUseLocalCache) return
    if (runtimeCachedUri) {
      setCachedUriState({
        rawUri,
        cachedUri: runtimeCachedUri,
      })
      return
    }
    let canceled = false
    setCachedUriState((prev) => {
      if (prev?.rawUri == rawUri) return prev
      return null
    })
    void getCachedImageUri(rawUri).then((cachedUri) => {
      if (canceled) return
      if (cachedUri) {
        setCachedUriState({
          rawUri,
          cachedUri,
        })
        return
      }
      void cacheImageUri(rawUri).then((uri) => {
        if (canceled) return
        if (!uri || uri == rawUri) return
        setCachedUriState({
          rawUri,
          cachedUri: uri,
        })
      })
    })
    return () => {
      canceled = true
    }
  }, [rawUri, runtimeCachedUri, shouldUseLocalCache])

  let uri = cachedUri || rawUri

  if (!uri) return <EmptyPic style={style} nativeID={nativeID} />

  const isRemote = /^https?:\/\//i.test(uri)
  const showNetworkImage = !isRemote || (isLoaded && !isError)
  const shouldShowFallback = showFallback &&
    isRemote &&
    isError
  const shouldHideImageLayer = shouldShowFallback && !showNetworkImage

  return (
    <View style={StyleSheet.compose(styles.imageWrap, style)}>
      {shouldShowFallback ? <_Image source={loadFailPic} style={styles.imageLayer} resizeMode="cover" /> : null}
      <FastImage
        style={StyleSheet.compose(styles.imageLayer, shouldHideImageLayer ? styles.hiddenLayer : undefined)}
        transition={shouldShowFallback ? 'fade' : 'none'}
        source={{
          uri,
          headers: isRemote ? defaultHeaders : undefined,
          priority: FastImage.priority.normal,
          cache: isRemote ? (cache === false ? 'web' : 'immutable') : 'immutable',
        }}
        onError={handleError}
        onLoad={handleLoad}
        resizeMode={resizeMode}
        blurRadius={blurRadius}
        nativeID={nativeID}
      />
    </View>
  )
}, (prevProps, nextProps) => {
  return prevProps.url == nextProps.url &&
    prevProps.style == nextProps.style &&
    prevProps.nativeID == nextProps.nativeID &&
    prevProps.cache == nextProps.cache &&
    prevProps.blurRadius == nextProps.blurRadius &&
    prevProps.showFallback == nextProps.showFallback
})

export const getSize = (uri: string, success: (width: number, height: number) => void, failure?: (error: any) => void) => {
  _Image.getSize(uri, success, failure)
}
export const clearMemoryCache = async() => {
  return Promise.all([FastImage.clearMemoryCache(), FastImage.clearDiskCache()])
}
export default Image

const styles = createStyle({
  emptyPicWrap: {
    borderRadius: BorderRadius.normal,
    overflow: 'hidden',
  },
  emptyPicImage: {
    width: '100%',
    height: '100%',
  },
  imageWrap: {
    overflow: 'hidden',
  },
  imageLayer: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  hiddenLayer: {
    opacity: 0,
  },
})
