/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

// Lux Proprietary
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Dimensions, Easing, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import { MdiIcon } from '@/components/common/MdiIcon'
import Image from '@/components/common/Image'
import ImagePicker from 'react-native-image-crop-picker'
import {
  EmptyState,
  Hairline,
  IconButton,
  MagDialog,
  MagTopBar,
  OptionRow,
  SectionHeader,
  SettingRow,
  UnderlineInput,
} from '@/components/magazine'
import { confirmDialog, createStyle, openUrl, tipDialog, toast } from '@/utils/tools'
import { useStatus } from '@/store/sync/hook'
import { SYNC_CODE } from '@/plugins/sync/constants'
import { setSyncMessage } from '@/core/sync'
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
import { DEFAULT_USER_AVATAR, DEFAULT_USER_NAME, getUserAvatar, getUserAvatarDataUrl, getUserGender, getUserName, getUserSignature, saveUserAvatar, saveUserGender, saveUserName, saveUserSignature, getSyncHost, setSyncHost as saveSyncHost, addSyncHostHistory, getSyncMode, setSyncMode, clearLuxAuth, clearSyncAuthKey, clearSyncConflictMode, setSyncLoginCompleted } from '@/utils/data'
import { getSyncHostHistory, removeSyncHostHistory } from '@/plugins/sync/data'
import { connectLuxServer, connectServer, disconnectServer, pushLuxProfileToServer, syncLuxProfileOnLogin } from '@/plugins/sync'
import { useI18n } from '@/lang'
import { useSettingValue } from '@/store/setting/hook'
import { setLanguage, updateSetting } from '@/core/common'
import { setApiSource } from '@/core/apiSource'
import { useVersionDownloadProgressUpdated, useVersionInfo } from '@/store/version/hook'
import { checkUpdate } from '@/core/version'
import versionState from '@/store/version/state'
import { resolveChannel, upcomingStableVersion } from '@/utils/releaseChannel'
import { pushSyncLoginScreen } from '@/navigation/navigation'
import { ResourceCacheDetail, useResourceCache } from './ResourceCacheSection'
import VersionChangelogDetail from './VersionChangelogDetail'
import ChoosePath, { type ChoosePathType } from '@/components/common/ChoosePath'
import { exportLuxBackupFile, importLuxBackupFile } from '@/utils/playHistory/backupIO'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { H1_AFTER_TOP, PAGE_GUTTER, magType } from '@/theme/magazineType'
import { LUX_THEME_IDS, luxThemeRegistry, type LuxColors, type LuxThemeId } from '@/theme/luxTokens'
import { STATS_PAGE_STYLES, type StatsPageStyle } from '@/utils/playHistory/statsPageStyle'
import { useStatsPageStylePreference } from '@/components/stats/useListeningStatsModel'

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
  const styles = useLuxStyles()
  const { colors, id: luxThemeId, setLuxTheme, mode: luxColorMode } = useLuxTheme()
  const r = magazineRoles(colors)

  const t = useI18n()
  const luxThemeLabel = (id: LuxThemeId) => {
    switch (id) {
      case 'lime': return t('setting_lux_theme_lime')
      case 'mist_blue': return t('setting_lux_theme_mist_blue')
      case 'sakura': return t('setting_lux_theme_sakura')
      case 'lavender': return t('setting_lux_theme_lavender')
      case 'oat_milk': return t('setting_lux_theme_oat_milk')
      case 'ink_night': return t('setting_lux_theme_ink_night')
    }
  }
  const statusBarHeight = useStatusbarHeight()
  const gestureInsetBottom = useSystemGestureInsetBottom()
  const bottomDockHeight = BOTTOM_DOCK_BASE_HEIGHT + gestureInsetBottom
  const topPadding = statusBarHeight
  const detailSceneWidth = Dimensions.get('window').width
  const settingsMasthead = t('settings_masthead', { version: currentVer })
  const sourceRef = useRef<SourceType>(null)
  const backupPathRef = useRef<ChoosePathType>(null)
  const backupModeRef = useRef<'export' | 'import'>('export')
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
  const [isSettingsSearchOpen, setSettingsSearchOpen] = useState(false)
  const [isProfileDetailVisible, setProfileDetailVisible] = useState(false)
  const [isManagingApiSources, setIsManagingApiSources] = useState(false)
  const [syncHost, setSyncHostLocal] = useState('')
  const [syncHostHistory, setSyncHostHistoryLocal] = useState<string[]>([])
  const [isManagingSyncHosts, setIsManagingSyncHosts] = useState(false)
  const [isSyncHostModalVisible, setSyncHostModalVisible] = useState(false)
  const [syncHostDraft, setSyncHostDraft] = useState('')
  const [authCode, setAuthCode] = useState('')
  const [isAuthCodeModalVisible, setAuthCodeModalVisible] = useState(false)
  const [syncMode, setSyncModeLocal] = useState<LX.Sync.Mode>('lx')
  const [isLuxLoginModalVisible, setLuxLoginModalVisible] = useState(false)
  const [luxUsername, setLuxUsername] = useState('')
  const [luxPassword, setLuxPassword] = useState('')
  const [activeOptionDetail, setActiveOptionDetail] = useState<null | 'language' | 'theme' | 'statsPageStyle' | 'searchSource' | 'gender' | 'player' | 'sync' | 'syncFormat' | 'resourceCache' | 'changelog'>(null)
  const { style: statsPageStyle, setStyle: setStatsPageStyle } = useStatsPageStylePreference()
  const statsPageStyleLabel = (id: StatsPageStyle) => (
    id == 'replay' ? t('setting_stats_page_style_replay') : t('setting_stats_page_style_magazine')
  )
  const {
    cleaning: isCleaningResourceCache,
    cleaningAudio: isCleaningAudioCache,
    cleaningImage: isCleaningImageCache,
    cacheSize: resourceCacheSize,
    cacheSizeLabel: resourceCacheSizeLabel,
    audioCacheLabel,
    imageCacheLabel,
    handleCleanCache: handleCleanResourceCache,
    handleCleanAudioCache,
    handleCleanImageCache,
    handleGetAppCacheSize,
  } = useResourceCache()
  const defaultSignature = t('me_profile_status')
  const activeLangId = useSettingValue('common.langId')
  const searchDefaultSource = useSettingValue('search.defaultSource')
  const activeApiSource = useSettingValue('common.apiSource')
  const isSyncEnabled = useSettingValue('sync.enable')
  const syncStatus = useStatus()
  const userApiList = useUserApiList()
  const versionInfo = useVersionInfo()
  const releaseChannelSetting = useSettingValue('common.releaseChannel')
  const effectiveReleaseChannel = resolveChannel(releaseChannelSetting, currentVer)
  const releaseChannelLabel = effectiveReleaseChannel == 'dev'
    ? t('setting_release_channel_dev')
    : t('setting_release_channel_stable')
  const currentVersionLabel = `${currentVer} · ${releaseChannelLabel}`
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
  useEffect(() => {
    void getSyncMode().then(setSyncModeLocal)
  }, [])

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
    if (!isSyncEnabled) return t('sync_status_disabled')
    if (syncStatus.status) return t('setting_sync_status_enabled')
    switch (syncStatus.message) {
      case SYNC_CODE.missingAuthCode:
      case SYNC_CODE.authFailed:
        return t('setting_sync_code_fail')
      case SYNC_CODE.msgBlockedIp:
        return t('setting_sync_code_blocked_ip')
      default:
        return syncStatus.message || t('sync_status_disabled')
    }
  }, [isSyncEnabled, syncStatus, t])
  const aboutStatusText = versionInfo.waitStable
    ? t('version_wait_stable', {
      current: versionInfo.version,
      stable: versionInfo.newVersion?.version ?? '',
      next: upcomingStableVersion(versionInfo.version),
    })
    : versionInfo.status == 'downloading'
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
      setSettingsSearchOpen(Boolean(payload.keyword.trim()))
    }
    global.app_event.on('settingsSearchStateUpdated', handleSettingsSearchStateUpdated)
    return () => {
      global.app_event.off('settingsSearchStateUpdated', handleSettingsSearchStateUpdated)
    }
  }, [])

  const handleSettingsSearchChange = useCallback((keyword: string) => {
    setSettingsSearchQuery(keyword)
    global.app_event.settingsSearchStateUpdated({ keyword })
  }, [])

  const handleSettingsSearchFocus = useCallback(() => {
    Reflect.set(global.lx, 'keepPlayBarOnKeyboard', true)
  }, [])

  const handleSettingsSearchBlur = useCallback(() => {
    Reflect.set(global.lx, 'keepPlayBarOnKeyboard', false)
  }, [])

  const handleToggleSettingsSearch = useCallback(() => {
    setSettingsSearchOpen((open) => {
      if (open) handleSettingsSearchChange('')
      return !open
    })
  }, [handleSettingsSearchChange])

  const handleClearSettingsSearch = useCallback(() => {
    handleSettingsSearchChange('')
  }, [handleSettingsSearchChange])

  const normalizedSettingsSearchQuery = settingsSearchQuery.trim().toLowerCase()
  const matchesSettingsSearch = useCallback((...values: Array<string | null | undefined>) => {
    if (!normalizedSettingsSearchQuery) return true
    return values.some((value) => value?.toLowerCase().includes(normalizedSettingsSearchQuery))
  }, [normalizedSettingsSearchQuery])
  const showAppearanceSection = matchesSettingsSearch(
    t('setting_appearance'),
    t('setting_basic_lang'),
    activeLanguageLabel,
    t('setting_lux_theme'),
    t('setting_lux_theme_local_only'),
    t('setting_lux_theme_lime'),
    t('setting_lux_theme_mist_blue'),
    t('setting_lux_theme_sakura'),
    t('setting_lux_theme_lavender'),
    t('setting_lux_theme_oat_milk'),
    t('setting_lux_theme_ink_night'),
    t('setting_stats_page_style'),
    t('setting_stats_page_style_magazine'),
    t('setting_stats_page_style_replay'),
    t('setting_stats_page_style_local_only'),
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
  const showDataSection = matchesSettingsSearch(
    t('setting_data_and_sync'),
    t('setting_sync'),
    activeSyncStatusLabel,
    t('setting_sync_host_title'),
    t('setting_sync_format'),
    t('setting_sync_clear_conflict_mode'),
    t('setting_sync_clear_conflict_mode_desc'),
    t('setting_cache_management'),
    t('setting__other_resource_cache'),
    t('setting_other_cache_clear_btn'),
    t('setting_other_cache_size'),
    resourceCacheSizeLabel,
    t('setting_export_data'),
    t('setting_export_data_desc'),
    t('setting_import_data'),
    t('setting_import_data_desc'),
  )
  const showAboutSection = matchesSettingsSearch(
    t('setting_about'),
    'GitHub Releases',
    aboutStatusText,
    currentVer,
    t('version_label_current_ver'),
    t('version_about_update_title'),
    t('version_current_info'),
    t('version_changelog_title'),
    t('version_btn_check_update'),
    t('setting_release_channel'),
    t('setting_release_channel_dev'),
    t('setting_release_channel_stable'),
    releaseChannelLabel,
    currentVersionLabel,
  )
  const showAccountSection = !normalizedSettingsSearchQuery
  const showProfileHero = matchesSettingsSearch(
    nickname,
    signature,
    defaultSignature,
    t('setting_profile'),
  )
  const hasSettingSearchResults = showAppearanceSection ||
    showSearchAndPlayerSection ||
    showDataSection ||
    showAboutSection ||
    showAccountSection
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
  const optionDetailTitle = (() => {
    switch (activeOptionDetail) {
      case 'language': return t('setting_basic_lang')
      case 'theme': return t('setting_lux_theme')
      case 'statsPageStyle': return t('setting_stats_page_style')
      case 'searchSource': return t('setting_search_source')
      case 'gender': return t('setting_profile_gender')
      case 'player': return t('setting_custom_source_title')
      case 'sync': return t('setting_sync')
      case 'syncFormat': return t('setting_sync_format')
      case 'resourceCache': return t('setting_cache_management')
      case 'changelog': return t('version_about_update_title')
      default: return ''
    }
  })()
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

  useEffect(() => {
    switch (syncStatus.message) {
      case SYNC_CODE.authFailed:
        toast(t('setting_sync_code_fail'))
      case SYNC_CODE.missingAuthCode:
        setAuthCodeModalVisible(true)
        break
      case SYNC_CODE.msgBlockedIp:
        toast(t('setting_sync_code_blocked_ip'))
        break
      default:
        break
    }
  }, [syncStatus.message, t])

  const handleAddSource = () => {
    sourceRef.current?.showAddPicker()
  }
  const handleOpenSyncHostModal = () => {
    setSyncHostDraft('')
    setSyncHostModalVisible(true)
  }
  const handleCloseSyncHostModal = () => {
    setSyncHostDraft('')
    setSyncHostModalVisible(false)
  }
  const handleSaveSyncHost = () => {
    const host = syncHostDraft.trim()
    if (!syncHostRxp.test(host)) {
      toast(t('setting_sync_host_value_error_tip'), 'long')
      return
    }
    void saveSyncHost(host)
    void addSyncHostHistory(host)
    setSyncHostLocal(host)
    setSyncHostHistoryLocal(prev => {
      const next = prev.filter(h => h !== host)
      next.unshift(host)
      return next
    })
    updateSetting({ 'sync.enable': true })
    if (syncMode == 'lux') {
      setLuxLoginModalVisible(true)
    } else void connectServer(host)
    setSyncHostModalVisible(false)
  }
  const handleCancelSetCode = useCallback(() => {
    setSyncMessage('')
    setAuthCodeModalVisible(false)
  }, [])
  const handleSetCode = useCallback(() => {
    void connectServer(syncHost, authCode)
    setAuthCode('')
    setAuthCodeModalVisible(false)
  }, [syncHost, authCode])
  const handleCloseAuthCodeModal = () => {
    handleCancelSetCode()
  }
  const handleCloseLuxLoginModal = () => {
    setLuxLoginModalVisible(false)
    setLuxPassword('')
  }
  const handleLuxLogin = useCallback(() => {
    const username = luxUsername.trim()
    if (!syncHost || !username || !luxPassword) {
      toast(t('setting_sync_lux_login_missing_tip'), 'long')
      return
    }
    updateSetting({ 'sync.enable': true })
    void connectLuxServer(syncHost, username, luxPassword).then(() => {
      void syncLuxProfileOnLogin(syncHost).catch(() => null)
      setLuxLoginModalVisible(false)
      setLuxPassword('')
    }).catch((err: any) => {
      toast(String(err?.message ?? err), 'long')
    })
  }, [syncHost, luxUsername, luxPassword, t])
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
      if (syncMode == 'lux') {
        setLuxLoginModalVisible(true)
      } else void connectServer(host)
    }
  }
  const handleDeleteSyncHost = (index: number) => {
    const host = syncHostHistory[index]
    void removeSyncHostHistory(index)
    setSyncHostHistoryLocal(prev => {
      const next = [...prev]
      next.splice(index, 1)
      return next
    })
    if (host === syncHost) {
      updateSetting({ 'sync.enable': false })
      void disconnectServer()
      void saveSyncHost('')
      setSyncHostLocal('')
    }
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
        void getUserAvatarDataUrl().then(async avatar => pushLuxProfileToServer({ avatar })).catch(() => null)
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
      void pushLuxProfileToServer({ displayName: newName }).catch(() => null)
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
      void pushLuxProfileToServer({ signature: saveValue }).catch(() => null)
      setSignatureModalVisible(false)
    })
  }
  const handleOpenLanguageDetail = () => {
    setActiveOptionDetail('language')
  }
  const handleOpenThemeDetail = () => {
    setActiveOptionDetail('theme')
  }
  const handleOpenStatsPageStyleDetail = () => {
    setActiveOptionDetail('statsPageStyle')
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
    const mode = value == 'lux' ? 'lux' : 'lx'
    void setSyncMode(mode)
    setSyncModeLocal(mode)
    setActiveOptionDetail(null)
    if (mode == 'lux' && syncHost) setLuxLoginModalVisible(true)
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
      void pushLuxProfileToServer({ gender: nextGender }).catch(() => null)
      setActiveOptionDetail(null)
    })
  }
  const handleLogoutSyncAccount = useCallback(async() => {
    const confirmed = await confirmDialog({
      title: t('setting_sync_logout_title'),
      message: t('setting_sync_logout_message'),
      cancelButtonText: t('cancel'),
      confirmButtonText: t('setting_sync_logout_confirm'),
    })
    if (!confirmed) return

    updateSetting({ 'sync.enable': false })
    await Promise.all([
      disconnectServer(),
      clearLuxAuth(),
      clearSyncAuthKey(),
      clearSyncConflictMode(),
      saveSyncHost(''),
      setSyncLoginCompleted(false),
    ])
    setSyncHostLocal('')
    setLuxUsername('')
    setLuxPassword('')
    setAuthCode('')
    await pushSyncLoginScreen()
  }, [t])
  const handleClearSyncConflictMode = useCallback(async() => {
    await clearSyncConflictMode()
    toast(t('setting_sync_clear_conflict_mode_success'))
  }, [t])
  const handleCheckUpdate = () => {
    void checkUpdate()
  }
  const handleOpenChangelog = () => {
    setActiveOptionDetail('changelog')
  }
  const handleOpenResourceCacheDetail = useCallback(() => {
    handleGetAppCacheSize()
    setActiveOptionDetail('resourceCache')
  }, [handleGetAppCacheSize])
  const handleExportData = useCallback(() => {
    backupModeRef.current = 'export'
    backupPathRef.current?.show({
      title: t('setting_export_data_pick'),
      dirOnly: true,
      isPersist: true,
    })
  }, [t])
  const handleImportData = useCallback(() => {
    backupModeRef.current = 'import'
    backupPathRef.current?.show({
      title: t('setting_import_data_pick'),
      filter: ['json'],
    })
  }, [t])
  const handleBackupPath = useCallback((path: string) => {
    if (backupModeRef.current == 'export') {
      void exportLuxBackupFile(path).then(file => {
        toast(t('setting_export_data_success', { path: file }))
      }).catch(() => { toast(t('setting_export_data_fail')) })
      return
    }
    void importLuxBackupFile(path).then(result => {
      toast(t(result == 'ok' ? 'setting_import_data_success' : 'setting_import_data_invalid'))
    }).catch(() => { toast(t('setting_import_data_fail')) })
  }, [t])
  const handleSelectReleaseChannel = (value: 'stable' | 'dev') => {
    updateSetting({ 'common.releaseChannel': value })
    void (async() => {
      if (value == 'dev') {
        await tipDialog({
          title: t('setting_release_channel_dev'),
          message: t('setting_release_channel_dev_tip'),
        })
      }
      await checkUpdate({ force: true })
      if (value == 'stable' && versionState.versionInfo.waitStable) {
        await tipDialog({
          title: t('setting_release_channel_stable'),
          message: t('version_wait_stable', {
            current: versionState.versionInfo.version,
            stable: versionState.versionInfo.newVersion?.version ?? '',
            next: upcomingStableVersion(versionState.versionInfo.version),
          }),
        })
      }
    })()
  }
  const handleOpenReleasePage = () => {
    void openUrl('https://github.com/JuneDrinleng/lux-music-mobile/releases')
  }
  const handleOpenProfileDetail = useCallback(() => {
    setProfileDetailVisible(true)
  }, [])
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
    if (isAuthCodeModalVisible) {
      handleCloseAuthCodeModal()
      return true
    }
    if (isLuxLoginModalVisible) {
      handleCloseLuxLoginModal()
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

  useEffect(() => {
    global.app_event.on('openSettingsProfileDetail', handleOpenProfileDetail)
    return () => {
      global.app_event.off('openSettingsProfileDetail', handleOpenProfileDetail)
    }
  }, [handleOpenProfileDetail])

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: topPadding, paddingBottom: 18 + bottomDockHeight }]}
        showsVerticalScrollIndicator={false}
        bounces={false}
        alwaysBounceVertical={false}
        overScrollMode="never"
      >
        <MagTopBar
          masthead={settingsMasthead}
          trailing={
            <IconButton
              name="magnify"
              accessibilityLabel={t('action_search')}
              onPress={handleToggleSettingsSearch}
            />
          }
        />
        {isSettingsSearchOpen
          ? (
            <View style={styles.settingsSearchRow}>
              <View style={styles.settingsSearchField}>
                <UnderlineInput
                  value={settingsSearchQuery}
                  onChangeText={handleSettingsSearchChange}
                  onFocus={handleSettingsSearchFocus}
                  onBlur={handleSettingsSearchBlur}
                  placeholder={t('setting_search_topbar_placeholder')}
                  returnKeyType="search"
                  style={styles.settingsSearchInput}
                />
              </View>
              {settingsSearchQuery.length > 0
                ? (
                  <IconButton
                    name="close"
                    size={22}
                    accessibilityLabel={t('search_clear')}
                    onPress={handleClearSettingsSearch}
                  />
                  )
                : null}
            </View>
            )
          : null}
        <Text size={magType.h1.size} color={r.display} style={styles.pageTitle}>{t('nav_setting')}</Text>

        {showProfileHero
          ? (
            <TouchableOpacity style={styles.profileHeroRow} activeOpacity={0.82} onPress={handleOpenProfileDetail} accessibilityRole="button">
              <Image style={styles.profileHeroAvatar} url={avatarDisplayUrl} resizeMode="contain" />
              <View style={styles.profileHeroText}>
                <Text size={22} color={r.display} style={styles.profileHeroName} numberOfLines={1}>{nickname}</Text>
                <Text size={magType.meta.size} color={r.muted} numberOfLines={2}>{signature || defaultSignature}</Text>
              </View>
              <MdiIcon name="chevron-right" size={18} color={r.quiet} />
            </TouchableOpacity>
            )
          : null}

        {showAppearanceSection
          ? (
            <View style={styles.sectionBlock}>
              <SectionHeader title={t('setting_appearance')} meta={t('settings_meta_appearance')} showRule compactRule={!showProfileHero} />
              <SettingRow icon="translate" iconBg={r.iconWrap.orange} title={t('setting_basic_lang')} subtitle={activeLanguageLabel} onPress={handleOpenLanguageDetail} />
              <SettingRow icon="palette-outline" iconBg={r.iconWrap.orange} title={t('setting_lux_theme')} subtitle={luxThemeLabel(luxThemeId)} onPress={handleOpenThemeDetail} />
              <SettingRow icon="newspaper-variant-outline" iconBg={r.iconWrap.orange} title={t('setting_stats_page_style')} subtitle={statsPageStyleLabel(statsPageStyle)} onPress={handleOpenStatsPageStyleDetail} last />
            </View>
            )
          : null}

        {showSearchAndPlayerSection
          ? (
            <View style={styles.sectionBlock}>
              <SectionHeader title={t('setting_search_and_play')} meta={t('settings_meta_search_play')} showRule />
              <SettingRow icon="text-search" iconBg={r.iconWrap.green} title={t('setting_search_source')} subtitle={activeSearchSourceLabel} onPress={handleOpenSearchSourceDetail} />
              <SettingRow icon="puzzle-outline" iconBg={r.iconWrap.green} title={t('setting_basic_source')} subtitle={activeApiSourceLabel} onPress={handleOpenPlayerDetail} last />
            </View>
            )
          : null}

        {showDataSection
          ? (
            <View style={styles.sectionBlock}>
              <SectionHeader title={t('setting_data_and_sync')} meta={t('settings_meta_data_sync')} showRule />
              <SettingRow icon="server-network" iconBg={r.iconWrap.purple} title={t('setting_sync_host_title')} subtitle={activeSyncStatusLabel} onPress={handleOpenSyncDetail} />
              <SettingRow icon="swap-horizontal" iconBg={r.iconWrap.purple} title={t('setting_sync_format')} subtitle={syncMode == 'lux' ? 'lux music' : 'lx music'} onPress={handleOpenSyncFormatDetail} />
              <SettingRow icon="source-branch-remove" iconBg={r.iconWrap.purple} title={t('setting_sync_clear_conflict_mode')} subtitle={t('setting_sync_clear_conflict_mode_desc')} onPress={() => { void handleClearSyncConflictMode() }} />
              <SettingRow icon="broom" iconBg={r.iconWrap.purple} title={t('setting_cache_management')} subtitle={resourceCacheSizeLabel} onPress={handleOpenResourceCacheDetail} />
              <SettingRow icon="database-export-outline" iconBg={r.iconWrap.purple} title={t('setting_export_data')} subtitle={t('setting_export_data_desc')} onPress={handleExportData} />
              <SettingRow icon="database-import-outline" iconBg={r.iconWrap.purple} title={t('setting_import_data')} subtitle={t('setting_import_data_desc')} onPress={handleImportData} last />
            </View>
            )
          : null}

        {showAboutSection
          ? (
            <View style={styles.sectionBlock}>
              <SectionHeader title={t('setting_about')} meta={t('settings_meta_about')} showRule />
              <SettingRow icon="information-outline" iconBg={r.iconWrap.amber} title={t('version_label_current_ver')} subtitle={currentVersionLabel} onPress={handleOpenChangelog} />
              <SettingRow icon="update" iconBg={r.iconWrap.amber} title={t('version_btn_check_update')} subtitle={aboutStatusText} onPress={handleCheckUpdate} />
              <SettingRow icon="github" iconBg={r.iconWrap.amber} title="GitHub Releases" onPress={handleOpenReleasePage} last />
            </View>
            )
          : null}

        {showAccountSection
          ? (
            <View style={styles.sectionBlock}>
              <SectionHeader title={t('setting_account')} meta={t('settings_meta_account')} showRule />
              <SettingRow
                icon="logout"
                iconBg={r.iconWrap.red}
                title={t('setting_sync_logout_title')}
                subtitle={t('setting_sync_logout_desc')}
                onPress={handleLogoutSyncAccount}
                danger
                last
              />
            </View>
            )
          : null}

        {!hasSettingSearchResults
          ? (
            <EmptyState
              title={t('setting_search_empty_title')}
              message={t('setting_search_empty_text')}
            />
            )
          : null}

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
          contentContainerStyle={[styles.content, { paddingTop: topPadding, paddingBottom: 18 + bottomDockHeight }]}
          showsVerticalScrollIndicator={false}
          bounces={false}
          alwaysBounceVertical={false}
          overScrollMode="never"
        >
          <MagTopBar onBack={handleCloseProfileDetail} />
          <Text size={magType.h2.size} color={r.display} style={styles.subpageTitle}>{t('setting_profile')}</Text>

          <View style={styles.profileDetailHero}>
            <Image style={styles.profileDetailAvatar} url={avatarDisplayUrl} resizeMode="contain" />
            <View style={styles.profileHeroText}>
              <Text size={22} color={r.display} style={styles.profileDetailName} numberOfLines={1}>{nickname}</Text>
              <Text size={magType.meta.size} color={r.muted} style={styles.profileDetailSignature} numberOfLines={2}>{signature || defaultSignature}</Text>
            </View>
          </View>

          <SettingRow icon="image-outline" iconBg={r.accentSoft} title={t('setting_profile_avatar')} subtitle="JPEG / PNG" onPress={handlePickAvatar} />
          <SettingRow icon="card-account-details-outline" iconBg={r.accentSoft} title={t('setting_profile_nickname')} subtitle={nickname} onPress={handleShowNameModal} />
          <SettingRow icon="fountain-pen-tip" iconBg={r.accentSoft} title={t('setting_profile_signature')} subtitle={signature || defaultSignature} onPress={handleShowSignatureModal} />
          <SettingRow icon="gender-male-female" iconBg={r.accentSoft} title={t('setting_profile_gender')} subtitle={activeGenderLabel} onPress={handleOpenGenderDetail} last />
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
          contentContainerStyle={[styles.content, { paddingTop: topPadding, paddingBottom: 18 + bottomDockHeight }]}
          showsVerticalScrollIndicator={false}
          bounces={false}
          alwaysBounceVertical={false}
          overScrollMode="never"
        >
          <MagTopBar onBack={handleCloseOptionDetail} />
          <Text size={magType.h2.size} color={r.display} style={styles.subpageTitle}>{optionDetailTitle}</Text>

          {activeOptionDetail === 'theme'
            ? (
              <View style={styles.optionList}>
                <Text size={magType.meta.size} color={r.muted} style={styles.optionLocalNote}>{t('setting_lux_theme_local_only')}</Text>
                {LUX_THEME_IDS.map((id, index) => {
                  const item = luxThemeRegistry[id]
                  const isActive = luxThemeId === id
                  return (
                    <View key={id}>
                      <TouchableOpacity style={styles.themeOptionRow} activeOpacity={0.7} onPress={() => { setLuxTheme(id) }} accessibilityRole="radio" accessibilityState={{ selected: isActive }}>
                        <View style={styles.themeOptionBody}>
                          <View style={styles.themeSwatch}>
                            <View style={[styles.themeSwatchMain, { backgroundColor: item.colors.bg.app }]} />
                            <View style={[styles.themeSwatchAccent, { backgroundColor: item.colors.accent.primary }]} />
                          </View>
                          <Text size={magType.rowTitle.size} color={isActive ? r.ink : r.option} style={isActive ? styles.themeOptionLabelOn : styles.themeOptionLabel}>{luxThemeLabel(id)}</Text>
                        </View>
                        {isActive
                          ? <View style={[styles.optionActiveDot, luxColorMode === 'light' ? { borderWidth: 1.5, borderColor: r.ink } : null]} />
                          : null}
                      </TouchableOpacity>
                      {index < LUX_THEME_IDS.length - 1 ? <Hairline /> : null}
                    </View>
                  )
                })}
              </View>
              )
            : null}

          {activeOptionDetail === 'statsPageStyle'
            ? (
              <View style={styles.optionList}>
                <Text size={magType.meta.size} color={r.muted} style={styles.optionLocalNote}>{t('setting_stats_page_style_local_only')}</Text>
                {STATS_PAGE_STYLES.map((id, index) => (
                  <OptionRow key={id} label={statsPageStyleLabel(id)} selected={statsPageStyle === id} onPress={() => { setStatsPageStyle(id) }} last={index === STATS_PAGE_STYLES.length - 1} />
                ))}
              </View>
              )
            : null}

          {activeOptionDetail === 'language'
            ? (
              <View style={styles.optionList}>
                {languageOptions.map((option, index) => (
                  <OptionRow
                    key={option.locale}
                    label={option.label}
                    selected={(activeLangId ?? 'en_us') === option.locale}
                    onPress={() => { handleSelectLanguage(option.locale) }}
                    last={index === languageOptions.length - 1}
                  />
                ))}
              </View>
              )
            : null}

          {activeOptionDetail === 'searchSource'
            ? (
              <View style={styles.optionList}>
                {searchSourceOptions.map((option, index) => (
                  <OptionRow
                    key={option.value}
                    label={option.label}
                    selected={(searchDefaultSource ?? 'all') === option.value}
                    onPress={() => { handleSelectSearchSource(option.value) }}
                    last={index === searchSourceOptions.length - 1}
                  />
                ))}
              </View>
              )
            : null}

          {activeOptionDetail === 'gender'
            ? (
              <View style={styles.optionList}>
                {genderOptions.map((option, index) => (
                  <OptionRow
                    key={option.value}
                    label={option.label}
                    selected={gender === option.value}
                    onPress={() => { handleSelectGender(option.value) }}
                    last={index === genderOptions.length - 1}
                  />
                ))}
              </View>
              )
            : null}

          {activeOptionDetail === 'resourceCache'
            ? (
              <ResourceCacheDetail
                styles={styles}
                cacheSizeLabel={resourceCacheSizeLabel}
                cleaning={isCleaningResourceCache}
                cleaningAudio={isCleaningAudioCache}
                cleaningImage={isCleaningImageCache}
                canClean={resourceCacheSize != null}
                audioCacheLabel={audioCacheLabel}
                imageCacheLabel={imageCacheLabel}
                onClean={handleCleanResourceCache}
                onCleanAudio={handleCleanAudioCache}
                onCleanImage={handleCleanImageCache}
              />
              )
            : null}

          {activeOptionDetail === 'changelog'
            ? (
              <VersionChangelogDetail
                styles={styles}
                version={currentVer}
                releaseChannel={effectiveReleaseChannel}
                onSelectReleaseChannel={handleSelectReleaseChannel}
              />
              )
            : null}

          {activeOptionDetail === 'player'
            ? (
              <>
                <View style={styles.hiddenRefHost}>
                  <Source ref={sourceRef} embedded />
                </View>
                <View style={styles.optionList}>
                  {userApiList.map((api, index) => {
                    const isActive = activeApiSource === api.id
                    return (
                      <View key={api.id}>
                        <TouchableOpacity style={styles.manageOptionRow} activeOpacity={0.7} onPress={() => { handleSelectApiSource(api.id) }} accessibilityRole="button">
                          <Text size={magType.rowTitle.size} color={isActive && !isManagingApiSources ? r.ink : r.option} style={styles.manageOptionLabel} numberOfLines={1}>{api.name}</Text>
                          {isManagingApiSources
                            ? (
                              <IconButton
                                name="close"
                                size={22}
                                accessibilityLabel={t('delete')}
                                onPress={() => { handleDeleteApiSource(api.id) }}
                              />
                              )
                            : isActive
                              ? <View style={[styles.optionActiveDot, luxColorMode === 'light' ? { borderWidth: 1.5, borderColor: r.ink } : null]} />
                              : null}
                        </TouchableOpacity>
                        <Hairline />
                      </View>
                    )
                  })}
                  <TouchableOpacity style={styles.manageOptionRow} activeOpacity={0.7} onPress={handleAddSource} accessibilityRole="button">
                    <Text size={magType.rowTitle.size} color={r.option} style={styles.manageOptionLabel}>{t('setting_import_local_source')}</Text>
                  </TouchableOpacity>
                  <Hairline />
                  <TouchableOpacity style={styles.manageOptionRow} activeOpacity={0.7} onPress={handleToggleApiSourceManage} accessibilityRole="button">
                    <Text size={magType.rowTitle.size} color={isManagingApiSources ? r.danger : r.option} style={styles.manageOptionLabel}>
                      {isManagingApiSources ? t('setting_exit_manage') : t('setting_manage_source')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
              )
            : null}

          {activeOptionDetail === 'sync'
            ? (
              <View style={styles.optionList}>
                {syncHostHistory.map((host, index) => (
                  <View key={host}>
                    <TouchableOpacity style={styles.manageOptionRow} activeOpacity={0.7} onPress={() => { handleSelectSyncHost(host) }} accessibilityRole="button">
                      <Text size={magType.rowTitle.size} color={host === syncHost && !isManagingSyncHosts ? r.ink : r.option} style={styles.manageOptionLabel} numberOfLines={1}>{host}</Text>
                      {isManagingSyncHosts
                        ? (
                          <IconButton
                            name="close"
                            size={22}
                            accessibilityLabel={t('delete')}
                            onPress={() => { handleDeleteSyncHost(index) }}
                          />
                          )
                        : host === syncHost
                          ? <View style={[syncStatus.status ? styles.optionActiveDot : styles.optionErrorDot, luxColorMode === 'light' && syncStatus.status ? { borderWidth: 1.5, borderColor: r.ink } : null]} />
                          : null}
                    </TouchableOpacity>
                    <Hairline />
                  </View>
                ))}
                <TouchableOpacity style={styles.manageOptionRow} activeOpacity={0.7} onPress={handleOpenSyncHostModal} accessibilityRole="button">
                  <Text size={magType.rowTitle.size} color={r.option} style={styles.manageOptionLabel}>{t('setting_fill_sync_address')}</Text>
                </TouchableOpacity>
                <Hairline />
                <TouchableOpacity style={styles.manageOptionRow} activeOpacity={0.7} onPress={handleToggleSyncManage} accessibilityRole="button">
                  <Text size={magType.rowTitle.size} color={isManagingSyncHosts ? r.danger : r.option} style={styles.manageOptionLabel}>
                    {isManagingSyncHosts ? t('setting_exit_manage') : t('setting_manage_records')}
                  </Text>
                </TouchableOpacity>
              </View>
              )
            : null}

          {activeOptionDetail === 'syncFormat'
            ? (
              <View style={styles.optionList}>
                <OptionRow label={t('setting_sync_format_lx')} selected={syncMode == 'lx'} onPress={() => { handleSelectSyncFormat('lx') }} />
                <OptionRow label={t('setting_sync_format_lux')} selected={syncMode == 'lux'} onPress={() => { handleSelectSyncFormat('lux') }} last />
              </View>
              )
            : null}

        </ScrollView>
      </Animated.View>
      <MagDialog
        visible={isNameModalVisible}
        onClose={handleCloseNameModal}
        title={t('setting_profile_nickname_edit')}
        cancelLabel={t('cancel')}
        confirmLabel={t('metadata_edit_modal_confirm')}
        onCancel={handleCloseNameModal}
        onConfirm={handleSaveName}
      >
        <UnderlineInput
          value={nicknameDraft}
          onChangeText={setNicknameDraft}
          placeholder={t('setting_profile_nickname_placeholder')}
        />
      </MagDialog>
      <MagDialog
        visible={isSignatureModalVisible}
        onClose={handleCloseSignatureModal}
        title={t('setting_profile_signature_edit')}
        cancelLabel={t('cancel')}
        confirmLabel={t('metadata_edit_modal_confirm')}
        onCancel={handleCloseSignatureModal}
        onConfirm={handleSaveSignature}
      >
        <UnderlineInput
          value={signatureDraft}
          onChangeText={setSignatureDraft}
          placeholder={t('setting_profile_signature_placeholder')}
        />
      </MagDialog>
      <MagDialog
        visible={isSyncHostModalVisible}
        onClose={handleCloseSyncHostModal}
        title={t('setting_sync_host_label')}
        cancelLabel={t('cancel')}
        confirmLabel={t('metadata_edit_modal_confirm')}
        onCancel={handleCloseSyncHostModal}
        onConfirm={handleSaveSyncHost}
      >
        <UnderlineInput
          value={syncHostDraft}
          onChangeText={setSyncHostDraft}
          placeholder={t('setting_sync_host_value_tip')}
          inputMode="url"
          autoCapitalize="none"
        />
      </MagDialog>
      <MagDialog
        visible={isAuthCodeModalVisible}
        onClose={handleCloseAuthCodeModal}
        title={t('setting_sync_code_label')}
        cancelLabel={t('cancel')}
        confirmLabel={t('metadata_edit_modal_confirm')}
        onCancel={handleCancelSetCode}
        onConfirm={handleSetCode}
      >
        <UnderlineInput
          value={authCode}
          onChangeText={setAuthCode}
          placeholder={t('setting_sync_code_input_tip')}
        />
      </MagDialog>
      <MagDialog
        visible={isLuxLoginModalVisible}
        onClose={handleCloseLuxLoginModal}
        title={t('setting_sync_lux_login_title')}
        cancelLabel={t('cancel')}
        confirmLabel={t('setting_sync_lux_login_button')}
        onCancel={handleCloseLuxLoginModal}
        onConfirm={handleLuxLogin}
      >
        <UnderlineInput
          value={luxUsername}
          onChangeText={setLuxUsername}
          placeholder={t('setting_sync_lux_username')}
          autoCapitalize="none"
        />
        <UnderlineInput
          value={luxPassword}
          onChangeText={setLuxPassword}
          placeholder={t('setting_sync_lux_password')}
          secureTextEntry
        />
      </MagDialog>
      <ChoosePath ref={backupPathRef} onConfirm={handleBackupPath} />
    </View>
  )
}

const useLuxStyles = sharedLuxStyles((colors: LuxColors) => (createStyle({
  container: {
    flex: 1,
    backgroundColor: colors.bg.app,
  },
  content: {
    paddingHorizontal: PAGE_GUTTER,
    paddingBottom: 18,
  },
  pageTitle: {
    fontWeight: '800',
    letterSpacing: -1,
    marginTop: H1_AFTER_TOP,
  },
  settingsSearchRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 8,
    gap: 4,
  },
  settingsSearchField: {
    flex: 1,
    minWidth: 0,
  },
  settingsSearchInput: {
    fontSize: magType.settingsSearch.size,
    fontWeight: magType.settingsSearch.weight,
    lineHeight: magType.settingsSearch.lineHeight,
  },
  profileHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 22,
    marginBottom: 8,
    gap: 14,
  },
  profileHeroAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surface.well,
    overflow: 'hidden',
  },
  profileHeroText: {
    flex: 1,
    minWidth: 0,
  },
  profileHeroName: {
    fontWeight: '800',
    marginBottom: 4,
  },
  sectionBlock: {
    marginTop: 4,
  },
  subpageTitle: {
    fontWeight: '800',
    letterSpacing: -0.8,
    marginTop: H1_AFTER_TOP,
    marginBottom: 8,
  },
  optionList: {
    marginTop: 6,
  },
  optionLocalNote: {
    marginBottom: 8,
  },
  themeOptionRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  themeOptionLabel: {
    fontWeight: '600',
  },
  themeOptionLabelOn: {
    fontWeight: '800',
  },
  optionActiveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent.primary,
  },
  optionErrorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.danger,
  },
  manageOptionRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  manageOptionLabel: {
    flex: 1,
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  greetingBlock: {
    marginBottom: 18,
  },
  greetingTitle: {
    fontWeight: '700',
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
    backgroundColor: colors.bg.app,
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
    backgroundColor: colors.surface.card,
    padding: 2,
    shadowColor: colors.shadow.ink,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  avatarInner: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.surface.avatar,
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
    borderColor: colors.glass.rim58,
    backgroundColor: colors.glass.fill28,
    shadowColor: colors.shadow.ink,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  searchGlassTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.glass.fill08,
  },
  searchGlassFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.glass.fill62,
  },
  searchGlassRim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.glass.line16,
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
    color: colors.ink.input,
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
    backgroundColor: colors.bg.app,
  },
  optionDetailLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: APP_LAYER_INDEX.controls + 5,
    elevation: APP_LAYER_INDEX.controls + 5,
    backgroundColor: colors.bg.app,
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
    backgroundColor: colors.glass.fill78,
    borderWidth: 1,
    borderColor: colors.glass.backBorder,
    marginRight: 12,
  },
  profileDetailBackBtnWithLabel: {
    width: 82,
    flexDirection: 'row',
  },
  profileDetailBackText: {
    marginLeft: 2,
    fontWeight: '600',
  },
  profileDetailTitle: {
    fontWeight: '700',
    flex: 1,
  },
  profileDetailHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingTop: 8,
    paddingBottom: 22,
  },
  profileDetailAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surface.well,
    overflow: 'hidden',
  },
  profileDetailName: {
    fontWeight: '800',
    marginBottom: 4,
  },
  profileDetailSignature: {
    lineHeight: 16,
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
  accountCard: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.glass.rim72Warm,
    backgroundColor: colors.glass.fill90,
    paddingHorizontal: 18,
    paddingVertical: 18,
    marginBottom: 14,
    shadowColor: colors.shadow.ink,
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
    backgroundColor: colors.surface.card,
    padding: 4,
    shadowColor: colors.shadow.menu,
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
    borderColor: colors.glass.fill90,
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
    backgroundColor: colors.glass.fill78,
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
    backgroundColor: colors.surface.muted,
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
    backgroundColor: colors.surface.well,
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
    backgroundColor: colors.accent.soft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    overflow: 'hidden',
  },
  iconWrapOrange: { backgroundColor: colors.iconWrap.orange },
  iconWrapGreen: { backgroundColor: colors.iconWrap.green },
  iconWrapPurple: { backgroundColor: colors.iconWrap.purple },
  iconWrapAmber: { backgroundColor: colors.iconWrap.amber },
  iconWrapRed: { backgroundColor: colors.iconWrap.red },
  logoutIcon: {
    width: 22,
    height: 22,
  },
  groupRowAvatarWrap: {
    overflow: 'hidden',
    backgroundColor: colors.surface.card,
    padding: 2,
  },
  groupRowAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
    backgroundColor: colors.surface.well,
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
    backgroundColor: colors.line.divider,
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
  optionDetailLabel: {
    flex: 1,
  },
  optionDetailDivider: {
    height: 1,
    marginLeft: 18,
    marginRight: 18,
    backgroundColor: colors.line.divider,
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
    borderColor: colors.surface.importMuted,
    backgroundColor: colors.surface.mutedAlt,
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
    backgroundColor: colors.surface.emptyBlock,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
    shadowColor: colors.shadow.softCard,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  profileAvatarWrap: {
    overflow: 'hidden',
    padding: 0,
    backgroundColor: colors.surface.card,
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
    backgroundColor: colors.accent.primary,
  },
  themeLocalNote: {
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 8,
  },
  themeOptionBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
  },
  themeSwatch: {
    width: 44,
    height: 28,
    borderRadius: 8,
    overflow: 'hidden',
    flexDirection: 'row',
    marginRight: 12,
    borderWidth: 1,
    borderColor: colors.line.divider,
  },
  themeSwatchMain: {
    flex: 1,
  },
  themeSwatchAccent: {
    width: 12,
  },
  sourceActiveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent.primary,
  },
  sourceErrorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.danger,
  },
  aboutInfoWrap: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.surface.importMuted,
    backgroundColor: colors.surface.mutedAlt,
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
    borderColor: colors.line.modal,
    backgroundColor: colors.surface.card,
    shadowColor: colors.shadow.dialog,
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
    backgroundColor: colors.line.neutral,
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
    backgroundColor: colors.scrim.settings,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    backgroundColor: colors.surface.card,
    borderWidth: 1,
    borderColor: colors.surface.importMuted,
    shadowColor: colors.shadow.ink,
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
    backgroundColor: colors.surface.cancel,
  },
  modalBtnPrimary: {
    backgroundColor: colors.accent.primary,
  },
  modalBtnPrimaryText: {
    fontWeight: '600',
  },
})))
