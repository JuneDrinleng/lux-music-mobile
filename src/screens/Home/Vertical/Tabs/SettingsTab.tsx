import { useEffect, useMemo, useRef, useState } from 'react'
import { Keyboard, Modal, Platform, ScrollView, StyleSheet, Switch, TextInput, TouchableOpacity, TouchableWithoutFeedback, UIManager, View } from 'react-native'
import { BlurView } from '@react-native-community/blur'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import Image from '@/components/common/Image'
import FileSelect, { type FileSelectType } from '@/components/common/FileSelect'
import Input from '@/components/common/Input'
import { createStyle, openUrl } from '@/utils/tools'
import { sizeFormate } from '@/utils'
import { useStatusbarHeight } from '@/store/common/hook'
import { APP_LAYER_INDEX } from '@/config/constant'
import Source, { type SourceType } from '@/screens/Home/Views/Setting/settings/Basic/Source'
import Sync, { type SyncType } from '@/screens/Home/Views/Setting/settings/Sync'
import { DEFAULT_USER_AVATAR, DEFAULT_USER_NAME, getUserAvatar, getUserName, getUserSignature, saveUserAvatar, saveUserName, saveUserSignature } from '@/utils/data'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { useSettingValue } from '@/store/setting/hook'
import { setLanguage, updateSetting } from '@/core/common'
import { useVersionDownloadProgressUpdated, useVersionInfo } from '@/store/version/hook'

const SHOW_ADVANCED_SWITCHES = false
const BOTTOM_DOCK_BASE_HEIGHT = 112
const currentVer = process.versions.app
const hasNativeBlurView = Boolean(UIManager.getViewManagerConfig?.(Platform.OS === 'ios' ? 'BlurView' : 'AndroidBlurView'))
const languageOptions = [
  { locale: 'zh_cn', label: '\u7b80\u4f53\u4e2d\u6587' },
  { locale: 'zh_tw', label: '\u7e41\u9ad4\u4e2d\u6587' },
  { locale: 'en_us', label: 'English' },
] as const
const searchSourceOptions = [
  { value: 'all', label: 'All Sources' },
  { value: 'kw', label: 'Kuwo' },
  { value: 'kg', label: 'KuGou' },
  { value: 'tx', label: 'QQ Music' },
  { value: 'wy', label: 'NetEase' },
  { value: 'mg', label: 'Migu' },
] as const

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
  const shouldUseSearchBlur = hasNativeBlurView
  const headerTopPadding = statusBarHeight + 18
  const headerHeight = headerTopPadding + 44 + 16
  const sourceRef = useRef<SourceType>(null)
  const syncRef = useRef<SyncType>(null)
  const avatarFileRef = useRef<FileSelectType>(null)
  const [avatarUrl, setAvatarUrl] = useState(DEFAULT_USER_AVATAR)
  const [nickname, setNickname] = useState(DEFAULT_USER_NAME)
  const [nicknameDraft, setNicknameDraft] = useState(DEFAULT_USER_NAME)
  const [signature, setSignature] = useState('')
  const [signatureDraft, setSignatureDraft] = useState('')
  const [isNameModalVisible, setNameModalVisible] = useState(false)
  const [isSignatureModalVisible, setSignatureModalVisible] = useState(false)
  const [isLanguagePanelVisible, setLanguagePanelVisible] = useState(false)
  const [isSearchSourcePanelVisible, setSearchSourcePanelVisible] = useState(false)
  const defaultSignature = t('me_profile_status')
  const activeLangId = useSettingValue('common.langId')
  const searchDefaultSource = useSettingValue('search.defaultSource')
  const versionInfo = useVersionInfo()
  const versionProgress = useVersionDownloadProgressUpdated()
  const activeLanguageLabel = useMemo(() => {
    const activeLocale = activeLangId ?? 'en_us'
    return languageOptions.find(item => item.locale === activeLocale)?.label ?? 'English'
  }, [activeLangId])
  const activeSearchSourceLabel = useMemo(() => {
    return searchSourceOptions.find(item => item.value === (searchDefaultSource ?? 'all'))?.label ?? 'All Sources'
  }, [searchDefaultSource])
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
    void getUserAvatar().then((path) => {
      if (isUnmounted) return
      setAvatarUrl(path ?? DEFAULT_USER_AVATAR)
    })

    const handleAvatarUpdate = (path: string | null) => {
      setAvatarUrl(path ?? DEFAULT_USER_AVATAR)
    }
    global.app_event.on('userAvatarUpdated', handleAvatarUpdate)

    return () => {
      isUnmounted = true
      global.app_event.off('userAvatarUpdated', handleAvatarUpdate)
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
      void saveUserAvatar(path).then(() => {
        global.app_event.userAvatarUpdated(path)
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
  const handleToggleLanguagePanel = () => {
    setSearchSourcePanelVisible(false)
    setLanguagePanelVisible((visible) => !visible)
  }
  const handleToggleSearchSourcePanel = () => {
    setLanguagePanelVisible(false)
    setSearchSourcePanelVisible((visible) => !visible)
  }
  const handleSelectLanguage = (locale: typeof languageOptions[number]['locale']) => {
    setLanguage(locale)
    setLanguagePanelVisible(false)
  }
  const handleSelectSearchSource = (source: typeof searchSourceOptions[number]['value']) => {
    updateSetting({ 'search.defaultSource': source })
    setSearchSourcePanelVisible(false)
  }
  const handleOpenReleasePage = () => {
    void openUrl('https://github.com/JuneDrinleng/lux-music-mobile/releases')
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, styles.headerFloating, { paddingTop: headerTopPadding }]}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.avatarButton} activeOpacity={0.82} onPress={handlePickAvatar}>
            <View style={styles.avatarBubble}>
              <View style={styles.avatarInner}>
                <Image style={styles.avatarBubbleImage} url={avatarUrl} />
              </View>
            </View>
          </TouchableOpacity>
          <View style={styles.searchDock}>
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
              <View style={styles.searchContent}>
                <Icon name="search-2" rawSize={18} color="#666d7b" />
                <TextInput
                  style={styles.searchInput}
                  placeholder={t('setting_search_placeholder')}
                  placeholderTextColor="#9aa1ae"
                />
              </View>
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: headerHeight + 2, paddingBottom: 18 + bottomDockHeight }]}
        showsVerticalScrollIndicator={false}
        bounces={false}
        alwaysBounceVertical={false}
        overScrollMode="never"
      >
        <View style={styles.list}>
          <TouchableOpacity style={styles.accountCard} activeOpacity={0.85} onPress={handlePickAvatar}>
            <View style={styles.accountTopRow}>
              <View style={styles.accountAvatarWrap}>
                <Image style={styles.accountAvatar} url={avatarUrl} />
              </View>
              <View style={styles.accountInfo}>
                <Text size={27} color="#19171c" style={styles.accountName}>{nickname}</Text>
                <Text size={12} color="#766d75" numberOfLines={2}>{signature || defaultSignature}</Text>
              </View>
              <View style={styles.accountChevron}>
                <Icon name="chevron-right-2" rawSize={16} color="#9a8f98" />
              </View>
            </View>

            <View style={styles.accountMetaRow}>
              <View style={styles.accountMetaCard}>
                <Text size={11} color="#8b4b5f" style={styles.accountMetaLabel}>{t('setting_basic_lang')}</Text>
                <Text size={14} color="#19171c" style={styles.accountMetaValue}>{activeLanguageLabel}</Text>
              </View>
              <View style={[styles.accountMetaCard, styles.accountMetaCardLast]}>
                <Text size={11} color="#8b4b5f" style={styles.accountMetaLabel}>{t('version_label_current_ver')}</Text>
                <Text size={14} color="#19171c" style={styles.accountMetaValue}>{currentVer}</Text>
              </View>
            </View>
          </TouchableOpacity>

          <View style={styles.sectionCard}>
            <Text size={15} color="#111827" style={styles.cardTitle}>{t('setting_profile')}</Text>
            <TouchableOpacity style={styles.profileRow} activeOpacity={0.75} onPress={handlePickAvatar}>
              <View style={styles.profileLeft}>
                <View style={styles.profileIconWrap}>
                  <Icon name="album" rawSize={16} color="#5b6474" />
                </View>
                <Text size={14} color="#111827" style={styles.profileLabel}>{t('setting_profile_avatar')}</Text>
              </View>
              <View style={styles.profileRight}>
                <Text size={12} color="#8d838c" numberOfLines={1} style={styles.profileValue}>JPEG / PNG</Text>
                <Icon name="chevron-right-2" rawSize={16} color="#9ca3af" />
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.profileRow} activeOpacity={0.75} onPress={handleShowNameModal}>
              <View style={styles.profileLeft}>
                <View style={styles.profileIconWrap}>
                  <Icon name="menu" rawSize={16} color="#5b6474" />
                </View>
                <Text size={14} color="#111827" style={styles.profileLabel}>{t('setting_profile_nickname')}</Text>
              </View>
              <View style={styles.profileRight}>
                <Text size={12} color="#8d838c" numberOfLines={1} style={styles.profileValue}>{nickname}</Text>
                <Icon name="chevron-right-2" rawSize={16} color="#9ca3af" />
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.profileRow} activeOpacity={0.75} onPress={handleShowSignatureModal}>
              <View style={styles.profileLeft}>
                <View style={styles.profileIconWrap}>
                  <Icon name="comment" rawSize={16} color="#5b6474" />
                </View>
                <Text size={14} color="#111827" style={styles.profileLabel}>{t('setting_profile_signature')}</Text>
              </View>
              <View style={styles.profileRight}>
                <Text size={12} color="#8d838c" numberOfLines={1} style={styles.profileValue}>{signature || defaultSignature}</Text>
                <Icon name="chevron-right-2" rawSize={16} color="#9ca3af" />
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.sectionCard}>
            <Text size={15} color="#111827" style={styles.cardTitle}>{t('setting_appearance')}</Text>
            <TouchableOpacity style={styles.profileRow} activeOpacity={0.75} onPress={handleToggleLanguagePanel}>
              <View style={styles.profileLeft}>
                <View style={styles.profileIconWrap}>
                  <Icon name="setting" rawSize={16} color="#5b6474" />
                </View>
                <Text size={14} color="#111827" style={styles.profileLabel}>{t('setting_basic_lang')}</Text>
              </View>
              <View style={styles.profileRight}>
                <Text size={12} color="#8d838c" numberOfLines={1} style={styles.profileValue}>{activeLanguageLabel}</Text>
                <Icon name="chevron-right-2" rawSize={16} color="#9ca3af" style={isLanguagePanelVisible ? styles.chevronExpanded : undefined} />
              </View>
            </TouchableOpacity>
            {isLanguagePanelVisible
              ? <View style={styles.languageList}>
                  {languageOptions.map(option => {
                    const isActive = (activeLangId ?? 'en_us') === option.locale
                    return (
                      <TouchableOpacity
                        key={option.locale}
                        style={[styles.languageItem, isActive ? styles.languageItemActive : null]}
                        activeOpacity={0.8}
                        onPress={() => { handleSelectLanguage(option.locale) }}
                      >
                        <Text size={13} color={isActive ? '#111827' : '#374151'} style={styles.languageItemText}>{option.label}</Text>
                        {isActive ? <View style={styles.languageActiveDot} /> : null}
                      </TouchableOpacity>
                    )
                  })}
                </View>
              : null}
          </View>

          <View style={styles.sectionCard}>
            <Text size={15} color="#111827" style={styles.cardTitle}>Search</Text>
            <TouchableOpacity style={styles.profileRow} activeOpacity={0.75} onPress={handleToggleSearchSourcePanel}>
              <View style={styles.profileLeft}>
                <View style={styles.profileIconWrap}>
                  <Icon name="search-2" rawSize={16} color="#5b6474" />
                </View>
                <Text size={14} color="#111827" style={styles.profileLabel}>Search Source</Text>
              </View>
              <View style={styles.profileRight}>
                <Text size={12} color="#8d838c" numberOfLines={1} style={styles.profileValue}>{activeSearchSourceLabel}</Text>
                <Icon name="chevron-right-2" rawSize={16} color="#9ca3af" style={isSearchSourcePanelVisible ? styles.chevronExpanded : undefined} />
              </View>
            </TouchableOpacity>
            {isSearchSourcePanelVisible
              ? <View style={styles.languageList}>
                  {searchSourceOptions.map(option => {
                    const isActive = (searchDefaultSource ?? 'all') === option.value
                    return (
                      <TouchableOpacity
                        key={option.value}
                        style={[styles.languageItem, isActive ? styles.languageItemActive : null]}
                        activeOpacity={0.8}
                        onPress={() => { handleSelectSearchSource(option.value) }}
                      >
                        <Text size={13} color={isActive ? '#111827' : '#374151'} style={styles.languageItemText}>{option.label}</Text>
                        {isActive ? <View style={styles.languageActiveDot} /> : null}
                      </TouchableOpacity>
                    )
                  })}
                </View>
              : null}
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.cardTitleRow}>
              <Text size={15} color="#111827" style={styles.cardTitleNoMargin}>{t('setting_player')}</Text>
              <TouchableOpacity style={styles.addBtn} activeOpacity={0.75} onPress={handleAddSource}>
                <Text size={18} color="#111827" style={styles.addBtnText}>+</Text>
              </TouchableOpacity>
            </View>
            <Source ref={sourceRef} embedded />
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.cardTitleRow}>
              <Text size={15} color="#111827" style={styles.cardTitleNoMargin}>{t('setting_sync')}</Text>
              <TouchableOpacity style={styles.addBtn} activeOpacity={0.75} onPress={handleAddSyncHost}>
                <Text size={18} color="#111827" style={styles.addBtnText}>+</Text>
              </TouchableOpacity>
            </View>
            <Sync ref={syncRef} embedded />
          </View>

          <View style={styles.sectionCard}>
            <Text size={15} color="#111827" style={styles.cardTitle}>{t('setting_about')}</Text>
            <View style={styles.aboutInfoWrap}>
              <Text size={13} color="#111827">{`${t('version_label_current_ver')}${currentVer}`}</Text>
              <Text size={12} color="#6b7280">{aboutStatusText}</Text>
            </View>
            <TouchableOpacity style={styles.profileRow} activeOpacity={0.75} onPress={handleOpenReleasePage}>
              <View style={styles.profileLeft}>
                <View style={styles.profileIconWrap}>
                  <Icon name="download-2" rawSize={16} color="#5b6474" />
                </View>
                <Text size={14} color="#111827" style={styles.profileLabel}>GitHub Releases</Text>
              </View>
              <View style={styles.profileRight}>
                <Text size={12} color="#8d838c" numberOfLines={1} style={styles.profileValue}>{aboutStatusText}</Text>
                <Icon name="chevron-right-2" rawSize={16} color="#9ca3af" />
              </View>
            </TouchableOpacity>
          </View>
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
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(245,247,252,0.72)',
    backgroundColor: 'rgba(255,255,255,0.88)',
    shadowColor: '#2d3242',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
    paddingTop: 16,
    paddingBottom: 14,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  cardTitle: {
    fontWeight: '700',
    marginBottom: 12,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardTitleNoMargin: {
    fontWeight: '700',
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
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 18,
    backgroundColor: '#f8f9fd',
    borderWidth: 1,
    borderColor: '#edf0f7',
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  profileLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 12,
  },
  profileRight: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '48%',
  },
  profileIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: '#eef1f8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  profileLabel: {
    fontWeight: '600',
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
    marginTop: 4,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#edf0f7',
    backgroundColor: '#f8f9fd',
    overflow: 'hidden',
  },
  languageItem: {
    minHeight: 44,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  languageItemActive: {
    backgroundColor: '#eef3d7',
  },
  languageItemText: {
    fontWeight: '600',
  },
  languageActiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#8caf33',
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
