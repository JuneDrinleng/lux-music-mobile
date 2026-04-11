/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

// Lux Proprietary
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Dimensions, Easing, Keyboard, Modal, ScrollView, StyleSheet, Switch, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import Image from '@/components/common/Image'
import FileSelect, { type FileSelectType } from '@/components/common/FileSelect'
import Input from '@/components/common/Input'
import { createStyle, openUrl } from '@/utils/tools'
import { sizeFormate } from '@/utils'
import { useBackHandler } from '@/utils/hooks/useBackHandler'
import { useStatusbarHeight } from '@/store/common/hook'
import { APP_LAYER_INDEX } from '@/config/constant'
import Source, { type SourceType } from '@/screens/Home/Views/Setting/settings/Basic/Source'
import Sync, { type SyncType } from '@/screens/Home/Views/Setting/settings/Sync'
import { DEFAULT_USER_AVATAR, DEFAULT_USER_NAME, getUserAvatar, getUserGender, getUserName, getUserSignature, saveUserAvatar, saveUserGender, saveUserName, saveUserSignature } from '@/utils/data'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { useSettingValue } from '@/store/setting/hook'
import { setLanguage, updateSetting } from '@/core/common'
import { useVersionDownloadProgressUpdated, useVersionInfo } from '@/store/version/hook'

const SHOW_ADVANCED_SWITCHES = false
const BOTTOM_DOCK_BASE_HEIGHT = 112
const currentVer = process.versions.app
const languageOptions = [
  { locale: 'zh_cn', label: '\u7b80\u4f53\u4e2d\u6587' },
  { locale: 'zh_tw', label: '\u7e41\u9ad4\u4e2d\u6587' },
  { locale: 'en_us', label: 'English' },
] as const
const searchSourceOptionValues = ['all', 'kw', 'kg', 'tx', 'wy', 'mg'] as const
const genderOptionValues = ['male', 'female', 'unknown'] as const

const settingItems = [
  { title: 'App Theme', subtitle: 'Light Mode', icon: 'setting', enabled: true },
  { title: 'High Quality Streaming', subtitle: 'Use better audio quality on Wi-Fi', icon: 'play', enabled: true },
  { title: 'Download over Cellular', subtitle: 'Allow mobile data download', icon: 'download-2', enabled: false },
  { title: 'Show Notifications', subtitle: 'Mini controls on lock screen', icon: 'menu', enabled: true },
]

export default () => {
  const t = useI18n()
  const theme = useTheme()
  const statusBarHeight = useStatusbarHeight()
  const bottomDockHeight = BOTTOM_DOCK_BASE_HEIGHT
  const headerTopPadding = statusBarHeight + 18
  const headerHeight = headerTopPadding + 44 + 16
  const detailSceneWidth = Dimensions.get('window').width
  const sourceRef = useRef<SourceType>(null)
  const syncRef = useRef<SyncType>(null)
  const avatarFileRef = useRef<FileSelectType>(null)
  const profileDetailAnim = useRef(new Animated.Value(0)).current
  const optionDetailAnim = useRef(new Animated.Value(0)).current
  const [avatarUrl, setAvatarUrl] = useState<string | number | null>(DEFAULT_USER_AVATAR)
  const [avatarVersion, setAvatarVersion] = useState(0)
  const [nickname, setNickname] = useState(DEFAULT_USER_NAME)
  const [nicknameDraft, setNicknameDraft] = useState(DEFAULT_USER_NAME)
  const [signature, setSignature] = useState('')
  const [signatureDraft, setSignatureDraft] = useState('')
  const [gender, setGender] = useState<typeof genderOptionValues[number]>('unknown')
  const [isNameModalVisible, setNameModalVisible] = useState(false)
  const [isSignatureModalVisible, setSignatureModalVisible] = useState(false)
  const [settingsSearchQuery, setSettingsSearchQuery] = useState('')
  const [isProfileDetailVisible, setProfileDetailVisible] = useState(false)
  const [activeOptionDetail, setActiveOptionDetail] = useState<null | 'language' | 'searchSource' | 'gender'>(null)
  const defaultSignature = t('me_profile_status')
  const activeLangId = useSettingValue('common.langId')
  const searchDefaultSource = useSettingValue('search.defaultSource')
  const versionInfo = useVersionInfo()
  const versionProgress = useVersionDownloadProgressUpdated()
  const activeLanguageLabel = useMemo(() => {
    const activeLocale = activeLangId ?? 'en_us'
    return languageOptions.find(item => item.locale === activeLocale)?.label ?? 'English'
  }, [activeLangId])
  const searchSourceOptions = useMemo(() => [
    { value: 'all', label: t('setting_search_source_all') },
    { value: 'kw', label: 'Kuwo' },
    { value: 'kg', label: 'KuGou' },
    { value: 'tx', label: 'QQ Music' },
    { value: 'wy', label: 'NetEase' },
    { value: 'mg', label: 'Migu' },
  ] as const, [t])
  const genderOptions = useMemo(() => [
    { value: 'male', label: t('setting_profile_gender_male') },
    { value: 'female', label: t('setting_profile_gender_female') },
    { value: 'unknown', label: t('setting_profile_gender_unknown') },
  ] as const, [t])
  const activeSearchSourceLabel = useMemo(() => {
    return searchSourceOptions.find(item => item.value === (searchDefaultSource ?? 'all'))?.label ?? t('setting_search_source_all')
  }, [searchDefaultSource, searchSourceOptions, t])
  const activeGenderLabel = useMemo(() => {
    return genderOptions.find(item => item.value === gender)?.label ?? t('setting_profile_gender_unknown')
  }, [gender, genderOptions, t])
  const genderBadgeText = gender === 'male' ? 'M' : gender === 'female' ? 'F' : '?'
  const genderBadgeStyle = gender === 'male'
    ? styles.profileHeroBadgeMale
    : gender === 'female'
      ? styles.profileHeroBadgeFemale
      : styles.profileHeroBadgeUnknown
  const aboutStatusText = versionInfo.status == 'downloading'
    ? t('version_btn_downloading', {
      total: sizeFormate(versionProgress.total),
      current: sizeFormate(versionProgress.current),
      progress: versionProgress.total ? (versionProgress.current / versionProgress.total * 100).toFixed(2) : '0',
    })
    : versionInfo.isLatest
      ? t('version_tip_latest')
      : versionInfo.isUnknown
        ? t('version_tip_unknown')
        : versionInfo.status == 'checking'
          ? t('version_title_checking')
          : versionInfo.status == 'downloaded'
            ? t('version_title_update')
            : versionInfo.status == 'error'
              ? t('version_tip_failed')
              : t('version_title_new')

  useEffect(() => {
    let isUnmounted = false

    const syncAvatar = async() => {
      const path = await getUserAvatar()
      if (isUnmounted) return
      setAvatarUrl(path ?? DEFAULT_USER_AVATAR)
      setAvatarVersion(version => version + 1)
    }

    void syncAvatar()

    const handleAvatarUpdate = (path: string | null) => {
      setAvatarUrl(path ?? DEFAULT_USER_AVATAR)
      setAvatarVersion(version => version + 1)
    }
    const handleFocus = () => {
      void syncAvatar()
    }
    global.app_event.on('userAvatarUpdated', handleAvatarUpdate)
    global.app_event.on('focus', handleFocus)

    return () => {
      isUnmounted = true
      global.app_event.off('userAvatarUpdated', handleAvatarUpdate)
      global.app_event.off('focus', handleFocus)
    }
  }, [])
  useEffect(() => {
    let isUnmounted = false
    void getUserName().then((name) => {
      if (isUnmounted) return
      const value = name ?? DEFAULT_USER_NAME
      setNickname(value)
      setNicknameDraft(value)
    })

    const handleNameUpdate = (name: string) => {
      const value = name.trim() ? name : DEFAULT_USER_NAME
      setNickname(value)
      setNicknameDraft(value)
    }
    global.app_event.on('userNameUpdated', handleNameUpdate)

    return () => {
      isUnmounted = true
      global.app_event.off('userNameUpdated', handleNameUpdate)
    }
  }, [])
  useEffect(() => {
    let isUnmounted = false
    void getUserSignature().then((value) => {
      if (isUnmounted) return
      const signatureValue = value?.trim() ?? ''
      setSignature(signatureValue)
      setSignatureDraft(signatureValue || defaultSignature)
    })

    const handleSignatureUpdate = (value: string) => {
      const signatureValue = value.trim()
      setSignature(signatureValue)
      setSignatureDraft(signatureValue || defaultSignature)
    }
    global.app_event.on('userSignatureUpdated', handleSignatureUpdate)

    return () => {
      isUnmounted = true
      global.app_event.off('userSignatureUpdated', handleSignatureUpdate)
    }
  }, [defaultSignature])
  useEffect(() => {
    let isUnmounted = false
    void getUserGender().then((value) => {
      if (isUnmounted) return
      setGender(value ?? 'unknown')
    })

    const handleGenderUpdate = (value: typeof genderOptionValues[number]) => {
      setGender(value)
    }
    global.app_event.on('userGenderUpdated', handleGenderUpdate)

    return () => {
      isUnmounted = true
      global.app_event.off('userGenderUpdated', handleGenderUpdate)
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

  const normalizedSettingsSearchQuery = settingsSearchQuery.trim().toLowerCase()
  const matchesSettingsSearch = useCallback((...values: Array<string | null | undefined>) => {
    if (!normalizedSettingsSearchQuery) return true
    return values.some((value) => value?.toLowerCase().includes(normalizedSettingsSearchQuery))
  }, [normalizedSettingsSearchQuery])
  const showProfileEntry = matchesSettingsSearch(
    t('setting_profile'),
    t('setting_profile_avatar'),
    t('setting_profile_nickname'),
    t('setting_profile_signature'),
    t('setting_profile_gender'),
    activeGenderLabel,
    nickname,
    signature || defaultSignature,
    'JPEG',
    'PNG',
  )
  const showAppearanceSection = matchesSettingsSearch(
    t('setting_appearance'),
    t('setting_basic_lang'),
    activeLanguageLabel,
  )
  const showSearchSection = matchesSettingsSearch(
    t('setting_search'),
    t('setting_search_source'),
    activeSearchSourceLabel,
    ...searchSourceOptions.map((item) => item.label),
  )
  const showPlayerSection = matchesSettingsSearch(t('setting_player'))
  const showSyncSection = matchesSettingsSearch(t('setting_sync'))
  const showAboutSection = matchesSettingsSearch(
    t('setting_about'),
    'GitHub Releases',
    aboutStatusText,
    currentVer,
    t('version_label_current_ver'),
  )
  const showHeroSection = !normalizedSettingsSearchQuery || showProfileEntry
  const hasSettingSearchResults = showProfileEntry ||
    showAppearanceSection ||
    showSearchSection ||
    showPlayerSection ||
    showSyncSection ||
    showAboutSection
  const profileDetailTranslateX = useMemo(() => profileDetailAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [detailSceneWidth, 0],
  }), [detailSceneWidth, profileDetailAnim])
  const profileDetailOpacity = useMemo(() => profileDetailAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1],
  }), [profileDetailAnim])
  const optionDetailTranslateX = useMemo(() => optionDetailAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [detailSceneWidth, 0],
  }), [detailSceneWidth, optionDetailAnim])
  const optionDetailOpacity = useMemo(() => optionDetailAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1],
  }), [optionDetailAnim])
  const optionDetailTitle = activeOptionDetail === 'language'
    ? t('setting_basic_lang')
    : activeOptionDetail === 'searchSource'
      ? t('setting_search_source')
      : activeOptionDetail === 'gender'
        ? t('setting_profile_gender')
        : ''
  const avatarDisplayUrl = useMemo(() => {
    if (!avatarUrl) return DEFAULT_USER_AVATAR
    if (typeof avatarUrl != 'string') return avatarUrl
    const normalizedAvatarUrl = avatarUrl.startsWith('file://') ? avatarUrl.replace(/^file:\/\//, '') : avatarUrl
    if (normalizedAvatarUrl.startsWith('/')) return `file://${normalizedAvatarUrl}?v=${avatarVersion}`
    return `${avatarUrl}${avatarUrl.includes('?') ? '&' : '?'}v=${avatarVersion}`
  }, [avatarUrl, avatarVersion])

  useEffect(() => {
    Animated.timing(profileDetailAnim, {
      toValue: isProfileDetailVisible ? 1 : 0,
      duration: isProfileDetailVisible ? 248 : 220,
      easing: isProfileDetailVisible
        ? Easing.bezier(0.22, 0.84, 0.22, 1)
        : Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: true,
    }).start()
  }, [isProfileDetailVisible, profileDetailAnim])
  useEffect(() => {
    Animated.timing(optionDetailAnim, {
      toValue: activeOptionDetail ? 1 : 0,
      duration: activeOptionDetail ? 248 : 220,
      easing: activeOptionDetail
        ? Easing.bezier(0.22, 0.84, 0.22, 1)
        : Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: true,
    }).start()
  }, [activeOptionDetail, optionDetailAnim])

  const handleAddSource = () => {
    sourceRef.current?.showAddPicker()
  }
  const handleAddSyncHost = () => {
    syncRef.current?.showHostInput()
  }
  const handlePickAvatar = () => {
    avatarFileRef.current?.show({
      title: t('setting_profile_avatar_picker_title'),
      dirOnly: false,
      filter: ['jpg', 'jpeg', 'png', 'webp', 'bmp'],
    }, (path) => {
      void saveUserAvatar(path).then((savedPath) => {
        global.app_event.userAvatarUpdated(savedPath)
      })
    })
  }
  const handleShowNameModal = () => {
    setNicknameDraft(nickname)
    setNameModalVisible(true)
  }
  const handleCloseNameModal = () => {
    setNicknameDraft(nickname)
    setNameModalVisible(false)
  }
  const handleSaveName = () => {
    const draft = nicknameDraft.trim()
    const current = nickname.trim()
    let newName = DEFAULT_USER_NAME
    if (current) newName = current
    if (draft) newName = draft
    void saveUserName(newName).then(() => {
      setNickname(newName)
      global.app_event.userNameUpdated(newName)
      setNameModalVisible(false)
    })
  }
  const handleShowSignatureModal = () => {
    setSignatureDraft(signature || defaultSignature)
    setSignatureModalVisible(true)
  }
  const handleCloseSignatureModal = () => {
    setSignatureDraft(signature || defaultSignature)
    setSignatureModalVisible(false)
  }
  const handleSaveSignature = () => {
    const newSignature = signatureDraft.trim().substring(0, 140)
    const saveValue = newSignature && newSignature != defaultSignature ? newSignature : ''
    void saveUserSignature(saveValue || null).then(() => {
      setSignature(saveValue)
      setSignatureDraft(saveValue || defaultSignature)
      global.app_event.userSignatureUpdated(saveValue)
      setSignatureModalVisible(false)
    })
  }
  const handleOpenLanguageDetail = () => {
    setActiveOptionDetail('language')
  }
  const handleOpenSearchSourceDetail = () => {
    setActiveOptionDetail('searchSource')
  }
  const handleOpenGenderDetail = () => {
    setActiveOptionDetail('gender')
  }
  const handleCloseOptionDetail = () => {
    setActiveOptionDetail(null)
  }
  const handleSelectLanguage = (locale: typeof languageOptions[number]['locale']) => {
    setLanguage(locale)
    setActiveOptionDetail(null)
  }
  const handleSelectSearchSource = (source: typeof searchSourceOptionValues[number]) => {
    updateSetting({ 'search.defaultSource': source })
    setActiveOptionDetail(null)
  }
  const handleSelectGender = (nextGender: typeof genderOptionValues[number]) => {
    void saveUserGender(nextGender).then(() => {
      setGender(nextGender)
      global.app_event.userGenderUpdated(nextGender)
      setActiveOptionDetail(null)
    })
  }
  const handleOpenReleasePage = () => {
    void openUrl('https://github.com/JuneDrinleng/lux-music-mobile/releases')
  }
  const handleOpenProfileDetail = () => {
    setProfileDetailVisible(true)
  }
  const handleCloseProfileDetail = () => {
    setProfileDetailVisible(false)
  }

  useBackHandler(() => {
    if (isNameModalVisible) {
      handleCloseNameModal()
      return true
    }
    if (isSignatureModalVisible) {
      handleCloseSignatureModal()
      return true
    }
    if (activeOptionDetail) {
      handleCloseOptionDetail()
      return true
    }
    if (isProfileDetailVisible) {
      handleCloseProfileDetail()
      return true
    }
    return false
  })

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: headerHeight + 2, paddingBottom: 18 + bottomDockHeight }]}
        showsVerticalScrollIndicator={false}
        bounces={false}
        alwaysBounceVertical={false}
        overScrollMode="never"
      >
        <View style={styles.list}>
          {showHeroSection
            ? <TouchableOpacity style={styles.profileHero} activeOpacity={0.88} onPress={handleOpenProfileDetail}>
                <View style={styles.profileHeroAvatarWrap}>
                  <View style={styles.profileHeroAvatarInner}>
                    <Image style={styles.profileHeroAvatar} url={avatarDisplayUrl} resizeMode="contain" />
                  </View>
                  <View style={[styles.profileHeroBadge, genderBadgeStyle]}>
                    <Text size={11} color="#ffffff" style={styles.profileHeroBadgeText}>{genderBadgeText}</Text>
                  </View>
                </View>
                <View style={styles.profileHeroContent}>
                  <Text size={24} color="#1a1c1e" style={styles.profileHeroName}>{nickname}</Text>
                  <Text size={13} color="#5f6572" numberOfLines={2}>{signature || defaultSignature}</Text>
                  <View style={styles.profileHeroMetaRow}>
                    <View style={styles.profileHeroMetaPill}>
                      <Text size={11} color="#4b570d" style={styles.profileHeroMetaText}>{`LX Music ${currentVer}`}</Text>
                    </View>
                    <View style={styles.profileHeroMetaPillMuted}>
                      <Text size={11} color="#596069" style={styles.profileHeroMetaText}>{activeLanguageLabel}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.profileHeroArrow}>
                  <Icon name="chevron-right-2" rawSize={16} color="#8f96a2" />
                </View>
              </TouchableOpacity>
            : null}

          {showAppearanceSection
            ? <View style={styles.sectionCard}>
                <Text size={11} color="#838995" style={styles.sectionEyebrow}>{t('setting_appearance')}</Text>
                <View style={styles.sectionGroup}>
                  <TouchableOpacity style={styles.groupRow} activeOpacity={0.84} onPress={handleOpenLanguageDetail}>
                    <View style={styles.groupRowLeft}>
                      <View style={styles.groupRowIconWrap}>
                        <Icon name="setting" rawSize={18} color="#58651b" />
                      </View>
                      <View style={styles.groupRowTextWrap}>
                        <Text size={15} color="#20242d" style={styles.groupRowTitle}>{t('setting_basic_lang')}</Text>
                        <Text size={12} color="#767d89" numberOfLines={1}>{activeLanguageLabel}</Text>
                      </View>
                    </View>
                    <Icon name="chevron-right-2" rawSize={18} color="#9aa1ae" />
                  </TouchableOpacity>
                </View>
              </View>
            : null}

          {showSearchSection
            ? <View style={styles.sectionCard}>
                <Text size={11} color="#838995" style={styles.sectionEyebrow}>{t('setting_search')}</Text>
                <View style={styles.sectionGroup}>
                  <TouchableOpacity style={styles.groupRow} activeOpacity={0.84} onPress={handleOpenSearchSourceDetail}>
                    <View style={styles.groupRowLeft}>
                      <View style={styles.groupRowIconWrap}>
                        <Icon name="search-2" rawSize={18} color="#58651b" />
                      </View>
                      <View style={styles.groupRowTextWrap}>
                        <Text size={15} color="#20242d" style={styles.groupRowTitle}>{t('setting_search_source')}</Text>
                        <Text size={12} color="#767d89" numberOfLines={1}>{activeSearchSourceLabel}</Text>
                      </View>
                    </View>
                    <Icon name="chevron-right-2" rawSize={18} color="#9aa1ae" />
                  </TouchableOpacity>
                </View>
              </View>
            : null}

          {showPlayerSection
            ? <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <Text size={11} color="#838995" style={styles.sectionEyebrow}>{t('setting_player')}</Text>
                  <TouchableOpacity style={styles.sectionActionBtn} activeOpacity={0.82} onPress={handleAddSource}>
                    <Text size={18} color="#4b570d" style={styles.sectionActionText}>+</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.sectionGroup}>
                  <View style={styles.groupEmbedWrap}>
                    <Source ref={sourceRef} embedded />
                  </View>
                </View>
              </View>
            : null}

          {showSyncSection
            ? <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <Text size={11} color="#838995" style={styles.sectionEyebrow}>{t('setting_sync')}</Text>
                  <TouchableOpacity style={styles.sectionActionBtn} activeOpacity={0.82} onPress={handleAddSyncHost}>
                    <Text size={18} color="#4b570d" style={styles.sectionActionText}>+</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.sectionGroup}>
                  <View style={styles.groupEmbedWrap}>
                    <Sync ref={syncRef} embedded />
                  </View>
                </View>
              </View>
            : null}

          {showAboutSection
            ? <View style={styles.sectionCard}>
                <Text size={11} color="#838995" style={styles.sectionEyebrow}>{t('setting_about')}</Text>
                <View style={styles.sectionGroup}>
                  <View style={styles.groupRow}>
                    <View style={styles.groupRowLeft}>
                      <View style={styles.groupRowIconWrap}>
                        <Icon name="music" rawSize={18} color="#58651b" />
                      </View>
                      <View style={styles.groupRowTextWrap}>
                        <Text size={15} color="#20242d" style={styles.groupRowTitle}>{t('version_label_current_ver')}</Text>
                        <Text size={12} color="#767d89" numberOfLines={1}>{aboutStatusText}</Text>
                      </View>
                    </View>
                    <Text size={12} color="#8d838c" style={styles.aboutVersionValue}>{currentVer}</Text>
                  </View>
                  <View style={styles.groupDivider} />
                  <TouchableOpacity style={styles.groupRow} activeOpacity={0.84} onPress={handleOpenReleasePage}>
                    <View style={styles.groupRowLeft}>
                      <View style={styles.groupRowIconWrap}>
                        <Icon name="download-2" rawSize={18} color="#58651b" />
                      </View>
                      <View style={styles.groupRowTextWrap}>
                        <Text size={15} color="#20242d" style={styles.groupRowTitle}>GitHub Releases</Text>
                        <Text size={12} color="#767d89" numberOfLines={1}>{aboutStatusText}</Text>
                      </View>
                    </View>
                    <Icon name="chevron-right-2" rawSize={18} color="#9aa1ae" />
                  </TouchableOpacity>
                </View>
              </View>
            : null}

          {!hasSettingSearchResults
            ? <View style={styles.emptySearchCard}>
                <Text size={16} color="#111827" style={styles.emptySearchTitle}>{t('setting_search_empty_title')}</Text>
                <Text size={13} color="#707789" style={styles.emptySearchText}>{t('setting_search_empty_text')}</Text>
              </View>
            : null}
        </View>

        {
          SHOW_ADVANCED_SWITCHES ? (
            <View style={styles.list}>
              {settingItems.map(item => (
                <View key={item.title} style={styles.item}>
                  <View style={styles.left}>
                    <View style={styles.iconBox}>
                      <Icon name={item.icon} rawSize={18} color="#111827" />
                    </View>
                    <View style={styles.textWrap}>
                      <Text size={14} color="#111827" style={styles.itemTitle}>{item.title}</Text>
                      <Text size={11} color="#6b7280">{item.subtitle}</Text>
                    </View>
                  </View>
                  <Switch value={item.enabled} trackColor={{ false: '#d1d5db', true: '#9ca3af' }} thumbColor={item.enabled ? '#111827' : '#f9fafb'} />
                </View>
              ))}
            </View>
          ) : null
        }
      </ScrollView>
      <FileSelect ref={avatarFileRef} />
      <Animated.View
        pointerEvents={isProfileDetailVisible ? 'auto' : 'none'}
        style={[
          styles.profileDetailLayer,
          {
            opacity: profileDetailOpacity,
            transform: [{ translateX: profileDetailTranslateX }],
          },
        ]}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingTop: headerHeight + 2, paddingBottom: 18 + bottomDockHeight }]}
          showsVerticalScrollIndicator={false}
          bounces={false}
          alwaysBounceVertical={false}
          overScrollMode="never"
        >
          <View style={styles.profileDetailHeaderRow}>
            <TouchableOpacity style={styles.profileDetailBackBtn} activeOpacity={0.82} onPress={handleCloseProfileDetail}>
              <Icon name="chevron-left" rawSize={20} color="#232733" />
            </TouchableOpacity>
            <Text size={22} color="#1a1c1e" style={styles.profileDetailTitle}>{t('setting_profile')}</Text>
          </View>

          <View style={styles.profileDetailHero}>
            <View style={styles.profileDetailAvatarWrap}>
              <View style={styles.profileDetailAvatarInner}>
                <Image style={styles.profileDetailAvatar} url={avatarDisplayUrl} resizeMode="contain" />
              </View>
            </View>
            <Text size={22} color="#1a1c1e" style={styles.profileDetailName}>{nickname}</Text>
            <Text size={13} color="#6a707c" style={styles.profileDetailSignature}>{signature || defaultSignature}</Text>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionGroup}>
              <TouchableOpacity style={styles.groupRow} activeOpacity={0.84} onPress={handlePickAvatar}>
                <View style={styles.groupRowLeft}>
                  <View style={[styles.groupRowIconWrap, styles.groupRowAvatarWrap]}>
                    <Image style={styles.groupRowAvatar} url={avatarDisplayUrl} resizeMode="contain" />
                  </View>
                  <View style={styles.groupRowTextWrap}>
                    <Text size={15} color="#20242d" style={styles.groupRowTitle}>{t('setting_profile_avatar')}</Text>
                    <Text size={12} color="#767d89" numberOfLines={1}>JPEG / PNG</Text>
                  </View>
                </View>
                <Icon name="chevron-right-2" rawSize={18} color="#9aa1ae" />
              </TouchableOpacity>
              <View style={styles.groupDivider} />
              <TouchableOpacity style={styles.groupRow} activeOpacity={0.84} onPress={handleShowNameModal}>
                <View style={styles.groupRowLeft}>
                  <View style={styles.groupRowIconWrap}>
                    <Icon name="menu" rawSize={18} color="#58651b" />
                  </View>
                  <View style={styles.groupRowTextWrap}>
                    <Text size={15} color="#20242d" style={styles.groupRowTitle}>{t('setting_profile_nickname')}</Text>
                    <Text size={12} color="#767d89" numberOfLines={1}>{nickname}</Text>
                  </View>
                </View>
                <Icon name="chevron-right-2" rawSize={18} color="#9aa1ae" />
              </TouchableOpacity>
              <View style={styles.groupDivider} />
              <TouchableOpacity style={styles.groupRow} activeOpacity={0.84} onPress={handleShowSignatureModal}>
                <View style={styles.groupRowLeft}>
                  <View style={styles.groupRowIconWrap}>
                    <Icon name="comment" rawSize={18} color="#58651b" />
                  </View>
                  <View style={styles.groupRowTextWrap}>
                    <Text size={15} color="#20242d" style={styles.groupRowTitle}>{t('setting_profile_signature')}</Text>
                    <Text size={12} color="#767d89" numberOfLines={1}>{signature || defaultSignature}</Text>
                  </View>
                </View>
                <Icon name="chevron-right-2" rawSize={18} color="#9aa1ae" />
              </TouchableOpacity>
              <View style={styles.groupDivider} />
              <TouchableOpacity style={styles.groupRow} activeOpacity={0.84} onPress={handleOpenGenderDetail}>
                <View style={styles.groupRowLeft}>
                  <View style={[styles.groupRowIconWrap, genderBadgeStyle]}>
                    <Text size={13} color="#ffffff" style={styles.groupRowBadgeText}>{genderBadgeText}</Text>
                  </View>
                  <View style={styles.groupRowTextWrap}>
                    <Text size={15} color="#20242d" style={styles.groupRowTitle}>{t('setting_profile_gender')}</Text>
                    <Text size={12} color="#767d89" numberOfLines={1}>{activeGenderLabel}</Text>
                  </View>
                </View>
                <Icon name="chevron-right-2" rawSize={18} color="#9aa1ae" />
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </Animated.View>
      <Animated.View
        pointerEvents={activeOptionDetail ? 'auto' : 'none'}
        style={[
          styles.optionDetailLayer,
          {
            opacity: optionDetailOpacity,
            transform: [{ translateX: optionDetailTranslateX }],
          },
        ]}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingTop: headerHeight + 2, paddingBottom: 18 + bottomDockHeight }]}
          showsVerticalScrollIndicator={false}
          bounces={false}
          alwaysBounceVertical={false}
          overScrollMode="never"
        >
          <View style={styles.profileDetailHeaderRow}>
            <TouchableOpacity style={styles.profileDetailBackBtn} activeOpacity={0.82} onPress={handleCloseOptionDetail}>
              <Icon name="chevron-left" rawSize={20} color="#232733" />
            </TouchableOpacity>
            <Text size={22} color="#1a1c1e" style={styles.profileDetailTitle}>{optionDetailTitle}</Text>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionGroup}>
              {activeOptionDetail === 'language'
                ? languageOptions.map((option, index) => {
                  const isActive = (activeLangId ?? 'en_us') === option.locale
                  return (
                    <View key={option.locale}>
                      <TouchableOpacity
                        style={styles.optionDetailRow}
                        activeOpacity={0.84}
                        onPress={() => { handleSelectLanguage(option.locale) }}
                      >
                        <Text size={15} color={isActive ? '#20242d' : '#5f6572'} style={styles.optionDetailText}>{option.label}</Text>
                        {isActive ? <View style={styles.languageActiveDot} /> : null}
                      </TouchableOpacity>
                      {index < languageOptions.length - 1 ? <View style={styles.optionDetailDivider} /> : null}
                    </View>
                  )
                })
                : null}
              {activeOptionDetail === 'searchSource'
                ? searchSourceOptions.map((option, index) => {
                  const isActive = (searchDefaultSource ?? 'all') === option.value
                  return (
                    <View key={option.value}>
                      <TouchableOpacity
                        style={styles.optionDetailRow}
                        activeOpacity={0.84}
                        onPress={() => { handleSelectSearchSource(option.value) }}
                      >
                        <Text size={15} color={isActive ? '#20242d' : '#5f6572'} style={styles.optionDetailText}>{option.label}</Text>
                        {isActive ? <View style={styles.languageActiveDot} /> : null}
                      </TouchableOpacity>
                      {index < searchSourceOptions.length - 1 ? <View style={styles.optionDetailDivider} /> : null}
                    </View>
                  )
                })
                : null}
              {activeOptionDetail === 'gender'
                ? genderOptions.map((option, index) => {
                  const isActive = gender === option.value
                  return (
                    <View key={option.value}>
                      <TouchableOpacity
                        style={styles.optionDetailRow}
                        activeOpacity={0.84}
                        onPress={() => { handleSelectGender(option.value) }}
                      >
                        <Text size={15} color={isActive ? '#20242d' : '#5f6572'} style={styles.optionDetailText}>{option.label}</Text>
                        {isActive ? <View style={styles.languageActiveDot} /> : null}
                      </TouchableOpacity>
                      {index < genderOptions.length - 1 ? <View style={styles.optionDetailDivider} /> : null}
                    </View>
                  )
                })
                : null}
            </View>
          </View>
        </ScrollView>
      </Animated.View>
      <Modal
        visible={isNameModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={handleCloseNameModal}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalCard}>
                <Text size={17} color="#111827" style={styles.modalTitle}>{t('setting_profile_nickname_edit')}</Text>
                <Input
                  placeholder={t('setting_profile_nickname_placeholder')}
                  value={nicknameDraft}
                  onChangeText={setNicknameDraft}
                  style={[styles.modalInput, { backgroundColor: theme['c-primary-background'] }]}
                />
                <View style={styles.modalActions}>
                  <TouchableOpacity style={[styles.modalBtn, styles.modalBtnGhost]} onPress={handleCloseNameModal} activeOpacity={0.75}>
                    <Text size={14} color="#4b5563">{t('cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={handleSaveName} activeOpacity={0.85}>
                    <Text size={14} color="#111827" style={styles.modalBtnPrimaryText}>{t('metadata_edit_modal_confirm')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
      <Modal
        visible={isSignatureModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={handleCloseSignatureModal}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalCard}>
                <Text size={17} color="#111827" style={styles.modalTitle}>{t('setting_profile_signature_edit')}</Text>
                <Input
                  placeholder={t('setting_profile_signature_placeholder')}
                  value={signatureDraft}
                  onChangeText={setSignatureDraft}
                  style={[styles.modalInput, { backgroundColor: theme['c-primary-background'] }]}
                />
                <View style={styles.modalActions}>
                  <TouchableOpacity style={[styles.modalBtn, styles.modalBtnGhost]} onPress={handleCloseSignatureModal} activeOpacity={0.75}>
                    <Text size={14} color="#4b5563">{t('cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={handleSaveSignature} activeOpacity={0.85}>
                    <Text size={14} color="#111827" style={styles.modalBtnPrimaryText}>{t('metadata_edit_modal_confirm')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
    backgroundColor: '#eef0fb',
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  scroll: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 18,
    paddingBottom: 16,
  },
  headerFloating: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: APP_LAYER_INDEX.controls,
    elevation: 0,
    backgroundColor: '#eef0fb',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarButton: {
    borderRadius: 22,
  },
  avatarBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    padding: 2,
    shadowColor: '#2d3242',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  avatarInner: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#f3eef2',
  },
  avatarBubbleImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  searchDock: {
    flex: 1,
    marginLeft: 12,
    position: 'relative',
    zIndex: 8,
  },
  searchField: {
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(244,247,252,0.58)',
    backgroundColor: 'rgba(255,255,255,0.28)',
    shadowColor: '#2d3242',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
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
    paddingRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    height: '100%',
    marginLeft: 10,
    color: '#232733',
    fontSize: 14,
    paddingVertical: 0,
    backgroundColor: 'transparent',
  },
  list: {
    paddingHorizontal: 0,
  },
  profileDetailLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: APP_LAYER_INDEX.controls + 4,
    elevation: APP_LAYER_INDEX.controls + 4,
    backgroundColor: '#eef0fb',
  },
  optionDetailLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: APP_LAYER_INDEX.controls + 5,
    elevation: APP_LAYER_INDEX.controls + 5,
    backgroundColor: '#eef0fb',
  },
  profileDetailHeaderRow: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  profileDetailBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(231,236,245,0.96)',
    marginRight: 12,
  },
  profileDetailTitle: {
    fontWeight: '700',
  },
  profileDetailHero: {
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 24,
  },
  profileDetailAvatarWrap: {
    width: 108,
    height: 108,
    borderRadius: 54,
    padding: 5,
    backgroundColor: '#ffffff',
    marginBottom: 14,
  },
  profileDetailAvatarInner: {
    flex: 1,
    borderRadius: 49,
    overflow: 'hidden',
    backgroundColor: '#eef1f7',
  },
  profileDetailAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 49,
    backgroundColor: '#eef1f7',
  },
  profileDetailName: {
    fontWeight: '700',
    marginBottom: 6,
  },
  profileDetailSignature: {
    textAlign: 'center',
    lineHeight: 19,
  },
  profileHero: {
    borderRadius: 24,
    backgroundColor: '#ffffff',
    paddingHorizontal: 18,
    paddingVertical: 18,
    marginBottom: 26,
    borderWidth: 1,
    borderColor: 'rgba(231,236,245,0.96)',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#2d333b',
    shadowOpacity: 0.05,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  profileHeroAvatarWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    position: 'relative',
    padding: 4,
    backgroundColor: '#ffffff',
  },
  profileHeroAvatarInner: {
    flex: 1,
    borderRadius: 36,
    overflow: 'hidden',
    backgroundColor: '#eef1f7',
  },
  profileHeroAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 36,
    backgroundColor: '#eef1f7',
  },
  profileHeroBadge: {
    position: 'absolute',
    right: 1,
    bottom: 1,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#58651b',
    borderWidth: 3,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileHeroBadgeMale: {
    backgroundColor: '#4c78d8',
  },
  profileHeroBadgeFemale: {
    backgroundColor: '#cb6f9b',
  },
  profileHeroBadgeUnknown: {
    backgroundColor: '#58651b',
  },
  profileHeroBadgeText: {
    fontWeight: '700',
    lineHeight: 13,
  },
  profileHeroContent: {
    flex: 1,
    marginLeft: 16,
    marginRight: 12,
  },
  profileHeroName: {
    fontWeight: '700',
    marginBottom: 3,
  },
  profileHeroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 11,
  },
  profileHeroMetaPill: {
    borderRadius: 999,
    backgroundColor: '#dbeb92',
    paddingHorizontal: 11,
    paddingVertical: 5,
    marginRight: 8,
  },
  profileHeroMetaPillMuted: {
    borderRadius: 999,
    backgroundColor: '#eef1f7',
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  profileHeroMetaText: {
    fontWeight: '700',
  },
  profileHeroArrow: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountCard: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(245,247,252,0.72)',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 18,
    paddingVertical: 18,
    marginBottom: 14,
    shadowColor: '#2d3242',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  accountTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountAvatarWrap: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: '#ffffff',
    padding: 4,
    shadowColor: '#7b8193',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  accountAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 35,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  accountInfo: {
    flex: 1,
    marginLeft: 14,
  },
  accountName: {
    fontWeight: '700',
    marginBottom: 4,
  },
  accountChevron: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountMetaRow: {
    flexDirection: 'row',
    marginTop: 18,
  },
  accountMetaCard: {
    flex: 1,
    minHeight: 72,
    borderRadius: 18,
    backgroundColor: '#f7f8fd',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginRight: 10,
  },
  accountMetaCardLast: {
    marginRight: 0,
  },
  accountMetaLabel: {
    marginBottom: 9,
    fontWeight: '600',
  },
  accountMetaValue: {
    fontWeight: '700',
  },
  sectionCard: {
    marginBottom: 22,
  },
  sectionEyebrow: {
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 10,
    paddingLeft: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eef1f7',
  },
  sectionActionText: {
    lineHeight: 20,
    fontWeight: '700',
  },
  cardTitle: {
    fontWeight: '700',
    marginBottom: 10,
    paddingLeft: 4,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardTitleNoMargin: {
    fontWeight: '700',
  },
  sectionGroup: {
    borderRadius: 20,
    backgroundColor: '#f1f3fb',
    overflow: 'hidden',
  },
  groupRow: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  groupRowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 14,
  },
  groupRowIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#dbeb92',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  groupRowAvatarWrap: {
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    padding: 2,
  },
  groupRowAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
    backgroundColor: '#eef1f7',
  },
  groupRowBadgeText: {
    fontWeight: '700',
    lineHeight: 15,
  },
  groupRowTextWrap: {
    flex: 1,
  },
  groupRowTitle: {
    fontWeight: '700',
    marginBottom: 2,
  },
  groupDivider: {
    height: 1,
    marginLeft: 72,
    marginRight: 18,
    backgroundColor: '#e1e6ef',
  },
  inlineOptionList: {
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  inlineOptionRow: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 36,
  },
  inlineOptionText: {
    fontWeight: '600',
  },
  optionDetailRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  optionDetailText: {
    fontWeight: '600',
  },
  optionDetailDivider: {
    height: 1,
    marginLeft: 18,
    marginRight: 18,
    backgroundColor: '#e1e6ef',
  },
  groupEmbedWrap: {
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  addBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#edf0f7',
    backgroundColor: '#f8f9fd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    lineHeight: 22,
    fontWeight: '600',
  },
  profileRow: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
    marginBottom: 1,
  },
  profileLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 14,
  },
  profileRight: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '48%',
  },
  profileIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 16,
    backgroundColor: '#eef1f8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
    shadowColor: '#747b8f',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  profileAvatarWrap: {
    overflow: 'hidden',
    padding: 0,
    backgroundColor: '#ffffff',
  },
  profileAvatarThumb: {
    width: '100%',
    height: '100%',
  },
  profileLabel: {
    fontWeight: '700',
  },
  profileValue: {
    flexShrink: 1,
    textAlign: 'right',
    marginRight: 6,
  },
  chevronExpanded: {
    transform: [{ rotate: '90deg' }],
  },
  languageList: {
    marginTop: 2,
    marginLeft: 71,
  },
  languageItem: {
    minHeight: 40,
    paddingRight: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  languageItemActive: {
    backgroundColor: 'transparent',
  },
  languageItemText: {
    fontWeight: '600',
  },
  languageActiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#58651b',
  },
  aboutInfoWrap: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#edf0f7',
    backgroundColor: '#f8f9fd',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    gap: 4,
  },
  emptySearchCard: {
    minHeight: 104,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aboutVersionValue: {
    marginLeft: 12,
    fontWeight: '700',
  },
  emptySearchTitle: {
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySearchText: {
    lineHeight: 19,
  },
  item: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f1f1f3',
    backgroundColor: '#ffffff',
    shadowColor: '#111827',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 8,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    marginLeft: 10,
    flex: 1,
  },
  itemTitle: {
    fontWeight: '600',
    marginBottom: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(34, 39, 51, 0.16)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#edf0f7',
    shadowColor: '#2d3242',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  modalTitle: {
    fontWeight: '700',
    marginBottom: 12,
  },
  modalInput: {
    borderRadius: 16,
    height: 44,
  },
  modalActions: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 10,
  },
  modalBtn: {
    flexGrow: 1,
    flexShrink: 1,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnGhost: {
    backgroundColor: '#f1f4fb',
  },
  modalBtnPrimary: {
    backgroundColor: '#d9ef62',
  },
  modalBtnPrimaryText: {
    fontWeight: '600',
  },
})
