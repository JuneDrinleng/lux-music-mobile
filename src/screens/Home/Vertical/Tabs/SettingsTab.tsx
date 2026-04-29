/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

// Lux Proprietary
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Dimensions, Easing, Image as RNImage, Keyboard, Modal, ScrollView, StyleSheet, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import Image from '@/components/common/Image'
import ImagePicker from 'react-native-image-crop-picker'
import Input from '@/components/common/Input'
import { createStyle, openUrl, toast } from '@/utils/tools'
import { sizeFormate } from '@/utils'
import { useBackHandler } from '@/utils/hooks/useBackHandler'
import { useSystemGestureInsetBottom } from '@/utils/hooks'
import { useStatusbarHeight } from '@/store/common/hook'
import { APP_LAYER_INDEX } from '@/config/constant'
import Source, { type SourceType } from '@/screens/Home/Views/Setting/settings/Basic/Source'
import apiSourceInfo from '@/utils/musicSdk/api-source-info'
import { useUserApiList, state as userApiState } from '@/store/userApi'
import { removeUserApi } from '@/core/userApi'
import settingState from '@/store/setting/state'
import { DEFAULT_USER_AVATAR, DEFAULT_USER_NAME, getUserAvatar, getUserGender, getUserName, getUserSignature, saveUserAvatar, saveUserGender, saveUserName, saveUserSignature, getSyncHost, setSyncHost as saveSyncHost, addSyncHostHistory } from '@/utils/data'
import { getSyncHostHistory, removeSyncHostHistory } from '@/plugins/sync/data'
import { connectServer, disconnectServer } from '@/plugins/sync'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { useSettingValue } from '@/store/setting/hook'
import { setLanguage, updateSetting } from '@/core/common'
import { setApiSource } from '@/core/apiSource'
import { useVersionDownloadProgressUpdated, useVersionInfo } from '@/store/version/hook'
import maleImg from '../../../../../assets/img/male.png'
import femaleImg from '../../../../../assets/img/female.png'
import langImg from '../../../../../assets/img/language.png'
import searchImg from '../../../../../assets/img/search.png'
import sourceImg from '../../../../../assets/img/source.png'
import synImg from '../../../../../assets/img/syn.png'
import formatImg from '../../../../../assets/img/format.png'
import updateImg from '../../../../../assets/img/update.png'
import githubImg from '../../../../../assets/img/Github.png'

const BOTTOM_DOCK_BASE_HEIGHT = 164
const currentVer = process.versions.app
const syncHostRxp = /^https?:\/\/\S+/i
const languageOptions = [
  { locale: 'zh_cn', label: '\u7b80\u4f53\u4e2d\u6587' },
  { locale: 'zh_tw', label: '\u7e41\u9ad4\u4e2d\u6587' },
  { locale: 'en_us', label: 'English' },
] as const
const searchSourceOptionValues = ['all', 'kw', 'kg', 'tx', 'wy', 'mg'] as const
const genderOptionValues = ['male', 'female', 'unknown'] as const

export default () => {
  const t = useI18n()
  const theme = useTheme()
  const statusBarHeight = useStatusbarHeight()
  const gestureInsetBottom = useSystemGestureInsetBottom()
  const bottomDockHeight = BOTTOM_DOCK_BASE_HEIGHT + gestureInsetBottom
  const headerTopPadding = statusBarHeight + 18
  const headerHeight = headerTopPadding + 44 + 16
  const detailSceneWidth = Dimensions.get('window').width
  const sourceRef = useRef<SourceType>(null)
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
  const [isManagingApiSources, setIsManagingApiSources] = useState(false)
  const [syncHost, setSyncHostLocal] = useState('')
  const [syncHostHistory, setSyncHostHistoryLocal] = useState<string[]>([])
  const [isManagingSyncHosts, setIsManagingSyncHosts] = useState(false)
  const [isSyncHostModalVisible, setSyncHostModalVisible] = useState(false)
  const [syncHostDraft, setSyncHostDraft] = useState('')
  const [activeOptionDetail, setActiveOptionDetail] = useState<null | 'language' | 'searchSource' | 'gender' | 'player' | 'sync' | 'syncFormat'>(null)
  const defaultSignature = t('me_profile_status')
  const activeLangId = useSettingValue('common.langId')
  const searchDefaultSource = useSettingValue('search.defaultSource')
  const activeApiSource = useSettingValue('common.apiSource')
  const isSyncEnabled = useSettingValue('sync.enable')
  const userApiList = useUserApiList()
  const versionInfo = useVersionInfo()
  const versionProgress = useVersionDownloadProgressUpdated()
  const activeLanguageLabel = useMemo(() => {
    const activeLocale = activeLangId ?? 'en_us'
    return languageOptions.find(item => item.locale === activeLocale)?.label ?? 'English'
  }, [activeLangId])
  const searchSourceOptions = useMemo(() => [
    { value: 'all', label: t('setting_search_source_all') },
    { value: 'kw', label: t('source_real_kw') },
    { value: 'kg', label: t('source_real_kg') },
    { value: 'tx', label: t('source_real_tx') },
    { value: 'wy', label: t('source_real_wy') },
    { value: 'mg', label: t('source_real_mg') },
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
  const activeApiSourceLabel = useMemo(() => {
    const builtin = apiSourceInfo.find(api => api.id === activeApiSource)
    if (builtin) {
      // @ts-expect-error
      return t(`setting_basic_source_${builtin.id}`) || builtin.name
    }
    const userApi = userApiList.find(api => api.id === activeApiSource)
    if (userApi) return userApi.name
    return activeApiSource ?? ''
  }, [activeApiSource, userApiList, t])
  const activeSyncStatusLabel = useMemo(() => {
    return isSyncEnabled ? t('setting_sync_status_enabled') : t('sync_status_disabled')
  }, [isSyncEnabled, t])
  const genderBadgeText = gender === 'unknown' ? '?' : null
  const genderImgSource = gender === 'male' ? maleImg : gender === 'female' ? femaleImg : null
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
  const showSearchAndPlayerSection = matchesSettingsSearch(
    t('setting_search_and_play'),
    t('setting_search'),
    t('setting_search_source'),
    activeSearchSourceLabel,
    ...searchSourceOptions.map((item) => item.label),
    t('setting_player'),
    t('setting_basic_source'),
    activeApiSourceLabel,
  )
  const showSyncSection = matchesSettingsSearch(
    t('setting_sync'),
    activeSyncStatusLabel,
    t('setting_sync_host_title'),
    t('setting_sync_format'),
  )
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
    showSearchAndPlayerSection ||
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
        : activeOptionDetail === 'player'
          ? t('setting_custom_source_title')
          : activeOptionDetail === 'sync'
            ? t('setting_sync')
            : activeOptionDetail === 'syncFormat'
              ? t('setting_sync_format')
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
  useEffect(() => {
    if (activeOptionDetail !== 'sync') return
    void getSyncHost().then(host => { setSyncHostLocal(host ?? '') })
    void getSyncHostHistory().then(history => { setSyncHostHistoryLocal([...history]) })
  }, [activeOptionDetail])

  const handleAddSource = () => {
    sourceRef.current?.showAddPicker()
  }
  const handleOpenSyncHostModal = () => {
    setSyncHostDraft(syncHost)
    setSyncHostModalVisible(true)
  }
  const handleCloseSyncHostModal = () => {
    setSyncHostDraft(syncHost)
    setSyncHostModalVisible(false)
  }
  const handleSaveSyncHost = () => {
    const host = syncHostDraft.trim()
    if (!syncHostRxp.test(host)) {
      toast(t('setting_sync_host_value_error_tip'), 'long')
      return
    }
    void saveSyncHost(host)
    setSyncHostLocal(host)
    if (isSyncEnabled) void connectServer(host)
    setSyncHostModalVisible(false)
  }
  const handleSelectSyncHost = (host: string) => {
    if (isManagingSyncHosts) return
    if (host === syncHost && isSyncEnabled) {
      updateSetting({ 'sync.enable': false })
      void disconnectServer()
      toast(t('sync_status_disabled'))
    } else {
      void saveSyncHost(host)
      setSyncHostLocal(host)
      updateSetting({ 'sync.enable': true })
      void addSyncHostHistory(host)
      void connectServer(host)
      toast(t('setting_sync_status_enabled'))
    }
  }
  const handleDeleteSyncHost = (index: number) => {
    void removeSyncHostHistory(index)
    setSyncHostHistoryLocal(prev => {
      const next = [...prev]
      next.splice(index, 1)
      return next
    })
  }
  const handleToggleSyncManage = () => {
    setIsManagingSyncHosts(prev => !prev)
  }
  const handlePickAvatar = () => {
    void ImagePicker.openPicker({
      width: 400,
      height: 400,
      cropping: true,
      cropperCircleOverlay: true,
      mediaType: 'photo',
    }).then(image => {
      void saveUserAvatar(image.path).then(savedPath => {
        global.app_event.userAvatarUpdated(savedPath)
      })
    }).catch((err: any) => {
      if (err?.code !== 'E_PICKER_CANCELLED') toast(String(err?.message ?? err), 'long')
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
  const handleOpenPlayerDetail = () => {
    setActiveOptionDetail('player')
  }
  const handleOpenSyncDetail = () => {
    setActiveOptionDetail('sync')
  }
  const handleOpenSyncFormatDetail = () => {
    setActiveOptionDetail('syncFormat')
  }
  const handleSelectSyncFormat = (value: string) => {
    if (value === 'lux') {
      toast(t('toast_in_development'))
      return
    }
    setActiveOptionDetail(null)
  }
  const handleSelectApiSource = (id: string) => {
    if (isManagingApiSources) return
    setApiSource(id)
    setActiveOptionDetail(null)
  }
  const handleToggleApiSourceManage = () => {
    setIsManagingApiSources(prev => !prev)
  }
  const handleDeleteApiSource = useCallback((id: string) => {
    void removeUserApi([id]).finally(() => {
      if (settingState.setting['common.apiSource'] === id) {
        const fallback = apiSourceInfo.find(api => !api.disabled)?.id ??
          userApiState.list.find(api => api.id !== id)?.id ??
          ''
        setApiSource(fallback)
      }
    })
  }, [])
  const handleCloseOptionDetail = () => {
    setActiveOptionDetail(null)
    setIsManagingApiSources(false)
    setIsManagingSyncHosts(false)
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
    if (isSyncHostModalVisible) {
      handleCloseSyncHostModal()
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
                    {genderImgSource
                      ? <RNImage source={genderImgSource} style={styles.genderBadgeImgSmall} />
                      : <Text size={10} color="#ffffff" style={styles.profileHeroBadgeText}>{genderBadgeText}</Text>}
                  </View>
                </View>
                <View style={styles.profileHeroContent}>
                  <Text size={24} color="#1a1c1e" style={styles.profileHeroName}>{nickname}</Text>
                  <Text size={13} color="#5f6572" numberOfLines={2}>{signature || defaultSignature}</Text>
                  <View style={styles.profileHeroMetaRow}>
                    <View style={styles.profileHeroMetaPill}>
                      <Text size={11} color="#4b570d" style={styles.profileHeroMetaText}>{`LUX Music ${currentVer}`}</Text>
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
                      <View style={[styles.groupRowIconWrap, styles.iconWrapOrange]}>
                        <RNImage source={langImg} style={styles.settingRowImg} />
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

          {showSearchAndPlayerSection
            ? <View style={styles.sectionCard}>
                <Text size={11} color="#838995" style={styles.sectionEyebrow}>{t('setting_search_and_play')}</Text>
                <View style={styles.sectionGroup}>
                  <TouchableOpacity style={styles.groupRow} activeOpacity={0.84} onPress={handleOpenSearchSourceDetail}>
                    <View style={styles.groupRowLeft}>
                      <View style={[styles.groupRowIconWrap, styles.iconWrapGreen]}>
                        <RNImage source={searchImg} style={styles.settingRowImg} />
                      </View>
                      <View style={styles.groupRowTextWrap}>
                        <Text size={15} color="#20242d" style={styles.groupRowTitle}>{t('setting_search_source')}</Text>
                        <Text size={12} color="#767d89" numberOfLines={1}>{activeSearchSourceLabel}</Text>
                      </View>
                    </View>
                    <Icon name="chevron-right-2" rawSize={18} color="#9aa1ae" />
                  </TouchableOpacity>
                  <View style={styles.groupDivider} />
                  <TouchableOpacity style={styles.groupRow} activeOpacity={0.84} onPress={handleOpenPlayerDetail}>
                    <View style={styles.groupRowLeft}>
                      <View style={[styles.groupRowIconWrap, styles.iconWrapGreen]}>
                        <RNImage source={sourceImg} style={styles.settingRowImg} />
                      </View>
                      <View style={styles.groupRowTextWrap}>
                        <Text size={15} color="#20242d" style={styles.groupRowTitle}>{t('setting_basic_source')}</Text>
                        <Text size={12} color="#767d89" numberOfLines={1}>{activeApiSourceLabel}</Text>
                      </View>
                    </View>
                    <Icon name="chevron-right-2" rawSize={18} color="#9aa1ae" />
                  </TouchableOpacity>
                </View>
              </View>
            : null}

          {showSyncSection
            ? <View style={styles.sectionCard}>
                <Text size={11} color="#838995" style={styles.sectionEyebrow}>{t('setting_sync')}</Text>
                <View style={styles.sectionGroup}>
                  <TouchableOpacity style={styles.groupRow} activeOpacity={0.84} onPress={handleOpenSyncDetail}>
                    <View style={styles.groupRowLeft}>
                      <View style={[styles.groupRowIconWrap, styles.iconWrapPurple]}>
                        <RNImage source={synImg} style={styles.settingRowImg} />
                      </View>
                      <View style={styles.groupRowTextWrap}>
                        <Text size={15} color="#20242d" style={styles.groupRowTitle}>{t('setting_sync_host_title')}</Text>
                        <Text size={12} color="#767d89" numberOfLines={1}>{activeSyncStatusLabel}</Text>
                      </View>
                    </View>
                    <Icon name="chevron-right-2" rawSize={18} color="#9aa1ae" />
                  </TouchableOpacity>
                  <View style={styles.groupDivider} />
                  <TouchableOpacity style={styles.groupRow} activeOpacity={0.84} onPress={handleOpenSyncFormatDetail}>
                    <View style={styles.groupRowLeft}>
                      <View style={[styles.groupRowIconWrap, styles.iconWrapPurple]}>
                        <RNImage source={formatImg} style={styles.settingRowImg} />
                      </View>
                      <View style={styles.groupRowTextWrap}>
                        <Text size={15} color="#20242d" style={styles.groupRowTitle}>{t('setting_sync_format')}</Text>
                        <Text size={12} color="#767d89" numberOfLines={1}>{'lx music'}</Text>
                      </View>
                    </View>
                    <Icon name="chevron-right-2" rawSize={18} color="#9aa1ae" />
                  </TouchableOpacity>
                </View>
              </View>
            : null}

          {showAboutSection
            ? <View style={styles.sectionCard}>
                <Text size={11} color="#838995" style={styles.sectionEyebrow}>{t('setting_about')}</Text>
                <View style={styles.sectionGroup}>
                  <View style={styles.groupRow}>
                    <View style={styles.groupRowLeft}>
                      <View style={[styles.groupRowIconWrap, styles.iconWrapAmber]}>
                        <RNImage source={updateImg} style={styles.settingRowImg} />
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
                      <View style={[styles.groupRowIconWrap, styles.iconWrapAmber]}>
                        <RNImage source={githubImg} style={styles.settingRowImg} />
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

      </ScrollView>
      <Animated.View
        pointerEvents={isProfileDetailVisible ? 'auto' : 'none'}
        style={[
          styles.profileDetailLayer,
          {
            opacity: profileDetailOpacity,
            transform: [{ translateX: profileDetailTranslateX }],
            elevation: isProfileDetailVisible ? APP_LAYER_INDEX.controls + 4 : 0,
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
                    {genderImgSource
                      ? <RNImage source={genderImgSource} style={styles.genderBadgeImgLarge} />
                      : <Text size={12} color="#ffffff" style={styles.groupRowBadgeText}>{genderBadgeText}</Text>}
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
            elevation: activeOptionDetail ? APP_LAYER_INDEX.controls + 5 : 0,
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

          {activeOptionDetail === 'player'
            ? <>
                <View style={styles.hiddenRefHost}>
                  <Source ref={sourceRef} embedded />
                </View>
                <View style={styles.sectionCard}>
                  <View style={styles.sectionGroup}>
                    {userApiList.map((api) => {
                      const isActive = activeApiSource === api.id
                      return (
                        <View key={api.id}>
                          <TouchableOpacity
                            style={styles.optionDetailRow}
                            activeOpacity={0.84}
                            onPress={() => { handleSelectApiSource(api.id) }}
                          >
                            <Text size={15} color={isActive && !isManagingApiSources ? '#20242d' : '#5f6572'} style={styles.optionDetailText}>{api.name}</Text>
                            {isManagingApiSources
                              ? <TouchableOpacity activeOpacity={0.75} onPress={() => { handleDeleteApiSource(api.id) }}>
                                  <Text size={20} color="#ef4444">{'×'}</Text>
                                </TouchableOpacity>
                              : isActive ? <View style={styles.sourceActiveDot} /> : null}
                          </TouchableOpacity>
                          <View style={styles.optionDetailDivider} />
                        </View>
                      )
                    })}
                    <TouchableOpacity
                      style={styles.optionDetailRow}
                      activeOpacity={0.84}
                      onPress={handleAddSource}
                    >
                      <Text size={15} color="#5f6572" style={styles.optionDetailText}>{t('setting_import_local_source')}</Text>
                    </TouchableOpacity>
                    <View style={styles.optionDetailDivider} />
                    <TouchableOpacity
                      style={styles.optionDetailRow}
                      activeOpacity={0.84}
                      onPress={handleToggleApiSourceManage}
                    >
                      <Text size={15} color={isManagingApiSources ? '#ef4444' : '#5f6572'} style={styles.optionDetailText}>
                        {isManagingApiSources ? t('setting_exit_manage') : t('setting_manage_source')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            : null}

          {activeOptionDetail === 'sync'
            ? <View style={styles.sectionCard}>
                <View style={styles.sectionGroup}>
                  {syncHostHistory.map((host, index) => {
                    const isActive = host === syncHost
                    return (
                      <View key={host}>
                        <TouchableOpacity
                          style={styles.optionDetailRow}
                          activeOpacity={0.84}
                          onPress={() => { handleSelectSyncHost(host) }}
                        >
                          <Text size={15} color={isActive && isSyncEnabled && !isManagingSyncHosts ? '#20242d' : '#5f6572'} style={[styles.optionDetailText, styles.syncHostText]} numberOfLines={1}>{host}</Text>
                          {isManagingSyncHosts
                            ? <TouchableOpacity activeOpacity={0.75} onPress={() => { handleDeleteSyncHost(index) }}>
                                <Text size={20} color="#ef4444">{'×'}</Text>
                              </TouchableOpacity>
                            : isActive && isSyncEnabled ? <View style={styles.sourceActiveDot} /> : null}
                        </TouchableOpacity>
                        <View style={styles.optionDetailDivider} />
                      </View>
                    )
                  })}
                  <TouchableOpacity style={styles.optionDetailRow} activeOpacity={0.84} onPress={handleOpenSyncHostModal}>
                    <Text size={15} color="#5f6572" style={styles.optionDetailText}>{t('setting_fill_sync_address')}</Text>
                  </TouchableOpacity>
                  <View style={styles.optionDetailDivider} />
                  <TouchableOpacity style={styles.optionDetailRow} activeOpacity={0.84} onPress={handleToggleSyncManage}>
                    <Text size={15} color={isManagingSyncHosts ? '#ef4444' : '#5f6572'} style={styles.optionDetailText}>
                      {isManagingSyncHosts ? t('setting_exit_manage') : t('setting_manage_records')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            : null}

          {activeOptionDetail === 'syncFormat'
            ? <View style={styles.sectionCard}>
                <View style={styles.sectionGroup}>
                  <TouchableOpacity style={styles.optionDetailRow} activeOpacity={0.84} onPress={() => { handleSelectSyncFormat('lx') }}>
                    <Text size={15} color="#20242d" style={styles.optionDetailText}>{t('setting_sync_format_lx')}</Text>
                    <View style={styles.languageActiveDot} />
                  </TouchableOpacity>
                  <View style={styles.optionDetailDivider} />
                  <TouchableOpacity style={styles.optionDetailRow} activeOpacity={0.84} onPress={() => { handleSelectSyncFormat('lux') }}>
                    <Text size={15} color="#5f6572" style={styles.optionDetailText}>{t('setting_sync_format_lux')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            : null}
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
      <Modal
        visible={isSyncHostModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={handleCloseSyncHostModal}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalCard}>
                <Text size={17} color="#111827" style={styles.modalTitle}>{t('setting_sync_host_label')}</Text>
                <Input
                  placeholder={t('setting_sync_host_value_tip')}
                  value={syncHostDraft}
                  onChangeText={setSyncHostDraft}
                  style={[styles.modalInput, { backgroundColor: theme['c-primary-background'] }]}
                  inputMode="url"
                  autoCapitalize="none"
                />
                <View style={styles.modalActions}>
                  <TouchableOpacity style={[styles.modalBtn, styles.modalBtnGhost]} onPress={handleCloseSyncHostModal} activeOpacity={0.75}>
                    <Text size={14} color="#4b5563">{t('cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={handleSaveSyncHost} activeOpacity={0.85}>
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
    flex: 1,
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
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
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
    backgroundColor: '#bfdbfe',
  },
  profileHeroBadgeFemale: {
    backgroundColor: '#fce7f3',
  },
  profileHeroBadgeUnknown: {
    backgroundColor: '#e2e8f0',
  },
  profileHeroBadgeText: {
    fontWeight: '700',
    lineHeight: 13,
  },
  settingRowImg: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  genderBadgeImgSmall: {
    width: 12,
    height: 12,
    resizeMode: 'contain',
  },
  genderBadgeImgLarge: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
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
    marginBottom: 14,
  },
  sectionEyebrow: {
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 6,
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
  },
  groupRow: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 10,
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
    overflow: 'hidden',
  },
  iconWrapOrange: { backgroundColor: '#ffedd5' },
  iconWrapGreen: { backgroundColor: '#d1fae5' },
  iconWrapPurple: { backgroundColor: '#ede9fe' },
  iconWrapAmber: { backgroundColor: '#fef9c3' },
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
  hiddenRefHost: {
    height: 0,
    overflow: 'hidden',
  },
  emptyApiSourceText: {
    textAlign: 'center',
    paddingVertical: 20,
  },
  syncHostText: {
    flex: 1,
    marginRight: 10,
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
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#c8e600',
  },
  sourceActiveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#c8e600',
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
    backgroundColor: '#c8e600',
  },
  modalBtnPrimaryText: {
    fontWeight: '600',
  },
})
