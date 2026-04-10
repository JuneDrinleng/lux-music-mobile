import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Dimensions,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native'
import { BlurView } from '@react-native-community/blur'
import { Search, X } from 'lucide-react-native'
import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import { setNavActiveId } from '@/core/common'
import { useI18n } from '@/lang'
import { useStatusbarHeight } from '@/store/common/hook'
import { useSettingValue } from '@/store/setting/hook'
import { createStyle } from '@/utils/tools'
import { DEFAULT_USER_AVATAR, getUserAvatar } from '@/utils/data'
import { APP_LAYER_INDEX } from '@/config/constant'

const hasNativeBlurView = Boolean(UIManager.getViewManagerConfig?.(Platform.OS === 'ios' ? 'BlurView' : 'AndroidBlurView'))

type SharedTopBarMode = 'music' | 'settings'

export default function SharedTopBar({ visible, mode }: { visible: boolean, mode: SharedTopBarMode }) {
  const t = useI18n()
  const statusBarHeight = useStatusbarHeight()
  const searchSource = useSettingValue('search.defaultSource')
  const shouldUseSearchBlur = hasNativeBlurView
  const topBarWidth = Math.max(0, Dimensions.get('window').width - 36)
  const modeAnim = useRef(new Animated.Value(mode === 'settings' ? 1 : 0)).current
  const [avatarUrl, setAvatarUrl] = useState(DEFAULT_USER_AVATAR)
  const [avatarVersion, setAvatarVersion] = useState(0)
  const [musicSearchQuery, setMusicSearchQuery] = useState('')
  const [settingsSearchQuery, setSettingsSearchQuery] = useState('')

  useEffect(() => {
    let isUnmounted = false

    const syncAvatar = async() => {
      const path = await getUserAvatar()
      if (isUnmounted) return
      setAvatarUrl(path ?? DEFAULT_USER_AVATAR)
      setAvatarVersion(version => version + 1)
    }

    void syncAvatar()

    const handleUserAvatarUpdated = (path: string | null) => {
      setAvatarUrl(path ?? DEFAULT_USER_AVATAR)
      setAvatarVersion(version => version + 1)
    }
    const handleFocus = () => {
      void syncAvatar()
    }
    global.app_event.on('userAvatarUpdated', handleUserAvatarUpdated)
    global.app_event.on('focus', handleFocus)

    return () => {
      isUnmounted = true
      global.app_event.off('userAvatarUpdated', handleUserAvatarUpdated)
      global.app_event.off('focus', handleFocus)
    }
  }, [])

  useEffect(() => {
    const handleVerticalSearchStateUpdated = (payload: { keyword: string }) => {
      setMusicSearchQuery(payload.keyword)
    }
    global.app_event.on('verticalSearchStateUpdated', handleVerticalSearchStateUpdated)
    return () => {
      global.app_event.off('verticalSearchStateUpdated', handleVerticalSearchStateUpdated)
    }
  }, [])

  useEffect(() => {
    const handleSettingsSearchStateUpdated = (payload: { keyword: string }) => {
      setSettingsSearchQuery(payload.keyword)
    }
    global.app_event.on('settingsSearchStateUpdated', handleSettingsSearchStateUpdated)
    return () => {
      global.app_event.off('settingsSearchStateUpdated', handleSettingsSearchStateUpdated)
    }
  }, [])

  useEffect(() => {
    Animated.timing(modeAnim, {
      toValue: mode === 'settings' ? 1 : 0,
      duration: 188,
      useNativeDriver: false,
    }).start()
  }, [mode, modeAnim])

  const handleOpenSearchPage = useCallback(() => {
    global.app_event.openVerticalSearchPage({
      keyword: musicSearchQuery.trim(),
      source: searchSource,
      submit: false,
    })
  }, [musicSearchQuery, searchSource])

  const handleMusicSearchClear = useCallback(() => {
    setMusicSearchQuery('')
    global.app_event.verticalSearchStateUpdated({
      keyword: '',
      source: searchSource,
    })
  }, [searchSource])

  const handleSettingsSearchChange = useCallback((keyword: string) => {
    setSettingsSearchQuery(keyword)
    global.app_event.settingsSearchStateUpdated({ keyword })
  }, [])

  const handleSettingsSearchClear = useCallback(() => {
    handleSettingsSearchChange('')
  }, [handleSettingsSearchChange])

  const avatarTranslateX = useMemo(() => modeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10],
  }), [modeAnim])
  const avatarOpacity = useMemo(() => modeAnim.interpolate({
    inputRange: [0, 0.6, 1],
    outputRange: [1, 0.12, 0],
  }), [modeAnim])
  const avatarScale = useMemo(() => modeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.9],
  }), [modeAnim])
  const searchDockWidth = useMemo(() => modeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [Math.max(0, topBarWidth - 56), topBarWidth],
  }), [modeAnim, topBarWidth])
  const searchDockTranslateX = useMemo(() => modeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [56, 0],
  }), [modeAnim])
  const searchTextOpacity = useMemo(() => modeAnim.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [1, 0.78, 1],
  }), [modeAnim])
  const avatarDisplayUrl = useMemo(() => {
    if (!avatarUrl || avatarUrl === DEFAULT_USER_AVATAR) return avatarUrl
    if (avatarUrl.startsWith('/')) return `file://${avatarUrl}?v=${avatarVersion}`
    return `${avatarUrl}${avatarUrl.includes('?') ? '&' : '?'}v=${avatarVersion}`
  }, [avatarUrl, avatarVersion])

  const displayQuery = mode === 'settings' ? settingsSearchQuery : musicSearchQuery
  const placeholder = mode === 'settings' ? t('setting_search_topbar_placeholder') : t('me_search_placeholder')

  if (!visible) return null

  return (
    <View style={[styles.headerFloating, { paddingTop: statusBarHeight + 18 }]}>
      <View style={styles.topBar}>
        <Animated.View
          pointerEvents={mode === 'settings' ? 'none' : 'auto'}
          style={[
            styles.avatarSlot,
            {
              opacity: avatarOpacity,
              transform: [
                { translateX: avatarTranslateX },
                { scale: avatarScale },
              ],
            },
          ]}
        >
          <TouchableOpacity style={styles.avatarButton} activeOpacity={0.82} onPress={() => { setNavActiveId('nav_setting') }}>
            <View style={styles.avatarBubble}>
              <View style={styles.avatarInner}>
                <Image style={styles.avatarImage} url={avatarDisplayUrl} resizeMode="contain" />
              </View>
            </View>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View style={[
          styles.searchDock,
          {
            width: searchDockWidth,
            transform: [{ translateX: searchDockTranslateX }],
          },
        ]}>
          <View style={styles.searchField}>
            {shouldUseSearchBlur
              ? <>
                  <BlurView
                    style={StyleSheet.absoluteFillObject}
                    blurType={Platform.OS === 'ios' ? 'chromeMaterialLight' : 'light'}
                    blurAmount={Platform.OS === 'ios' ? 34 : 24}
                    blurRadius={Platform.OS === 'android' ? 24 : undefined}
                    downsampleFactor={Platform.OS === 'android' ? 6 : undefined}
                    overlayColor={Platform.OS === 'android' ? 'rgba(255,255,255,0.16)' : 'transparent'}
                    reducedTransparencyFallbackColor="rgba(255,255,255,0.72)"
                  />
                  <View style={styles.searchGlassTint} pointerEvents="none" />
                </>
              : <View style={styles.searchGlassFallback} pointerEvents="none" />}
            <View style={styles.searchGlassRim} pointerEvents="none" />
            <Animated.View style={[styles.searchContent, { opacity: searchTextOpacity }]}>
              <Search size={17} color="#666d7b" strokeWidth={2.1} />
              {mode === 'settings'
                ? <TextInput
                    value={settingsSearchQuery}
                    onChangeText={handleSettingsSearchChange}
                    placeholder={placeholder}
                    placeholderTextColor="#9aa1ae"
                    style={styles.searchInput}
                    selectionColor="#6f7688"
                    returnKeyType="search"
                  />
                : <TouchableOpacity
                    style={styles.searchInputTrigger}
                    activeOpacity={0.82}
                    onPress={handleOpenSearchPage}
                  >
                      <Text
                        size={14}
                        color={musicSearchQuery ? '#232733' : '#9aa1ae'}
                        numberOfLines={1}
                        style={styles.searchInputText}
                      >
                        {musicSearchQuery || placeholder}
                      </Text>
                    </TouchableOpacity>}
              <TouchableOpacity
                style={styles.clearSearchButton}
                activeOpacity={0.8}
                onPress={mode === 'settings' ? handleSettingsSearchClear : handleMusicSearchClear}
                disabled={!displayQuery.length}
              >
                <X size={16} color={displayQuery.length ? '#666d7b' : '#bcc2cf'} strokeWidth={2.2} />
              </TouchableOpacity>
            </Animated.View>
          </View>
        </Animated.View>
      </View>
    </View>
  )
}

const styles = createStyle({
  headerFloating: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: APP_LAYER_INDEX.controls + 6,
    elevation: 0,
    backgroundColor: '#eef0fb',
    paddingHorizontal: 18,
    paddingBottom: 16,
  },
  topBar: {
    height: 44,
    position: 'relative',
  },
  avatarSlot: {
    width: 44,
    height: 44,
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 3,
  },
  avatarButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    padding: 2,
  },
  avatarInner: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#f3eef2',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
    backgroundColor: '#eef1f7',
  },
  searchDock: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 1,
  },
  searchField: {
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(244,247,252,0.58)',
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  searchGlassTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  searchGlassFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.62)',
  },
  searchGlassRim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  searchContent: {
    flex: 1,
    paddingLeft: 14,
    paddingRight: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInputTrigger: {
    flex: 1,
    height: '100%',
    marginLeft: 10,
    justifyContent: 'center',
  },
  searchInput: {
    flex: 1,
    height: '100%',
    marginLeft: 10,
    color: '#232733',
    fontSize: 14,
    paddingVertical: 0,
    paddingRight: 8,
  },
  searchInputText: {
    lineHeight: 18,
  },
  clearSearchButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
