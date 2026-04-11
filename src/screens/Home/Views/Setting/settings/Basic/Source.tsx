/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

import { memo, useCallback, useImperativeHandle, useMemo, useRef, forwardRef } from 'react'

import { TouchableOpacity, View } from 'react-native'

import SubTitle from '../../components/SubTitle'
import CheckBox from '@/components/common/CheckBox'
import { createStyle, tipDialog, toast } from '@/utils/tools'
import { setApiSource } from '@/core/apiSource'
import { useI18n } from '@/lang'
import apiSourceInfo from '@/utils/musicSdk/api-source-info'
import { useSettingValue } from '@/store/setting/hook'
import { state as userApiState, useStatus, useUserApiList } from '@/store/userApi'
import Button from '../../components/Button'
import UserApiEditModal, { type UserApiEditModalType } from './UserApiEditModal'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { removeUserApi, importUserApi } from '@/core/userApi'
import settingState from '@/store/setting/state'
import FileSelect, { type FileSelectType } from '@/components/common/FileSelect'
import { USER_API_SOURCE_FILE_EXT_RXP } from '@/config/constant'
import { readFile } from '@/utils/fs'

const apiSourceList = apiSourceInfo.map(api => ({
  id: api.id,
  name: api.name,
  disabled: api.disabled,
}))

interface SourceProps {
  embedded?: boolean
}

export interface SourceType {
  showAddPicker: () => void
}

interface DisplayItem {
  id: string
  name: string
  desc?: string
  statusLabel?: string
  removable: boolean
}

const useActive = (id: string) => {
  const activeLangId = useSettingValue('common.apiSource')
  const isActive = useMemo(() => activeLangId == id, [activeLangId, id])
  return isActive
}

const Item = ({
  id,
  name,
  desc,
  statusLabel,
  change,
  embedded = false,
  removable = false,
  isLast = false,
  onRemove,
}: {
  id: string
  name: string
  desc?: string
  statusLabel?: string
  change: (id: string) => void
  embedded?: boolean
  removable?: boolean
  isLast?: boolean
  onRemove?: (id: string) => void
}) => {
  const isActive = useActive(id)
  const theme = useTheme()

  const content = (
    <CheckBox marginBottom={embedded ? 0 : 5} check={isActive} onChange={() => { change(id) }} need>
      <Text style={styles.sourceLabel}>
        {name}
        {
          desc ? <Text style={styles.sourceDesc} color={theme['c-500']} size={13}>  {desc}</Text> : null
        }
        {
          statusLabel ? <Text style={styles.sourceStatus} size={13}>  {statusLabel}</Text> : null
        }
      </Text>
    </CheckBox>
  )

  if (!embedded) return content

  return (
    <View style={[styles.embeddedItem, !isLast && styles.embeddedItemBorder]}>
      <View style={styles.embeddedItemLeft}>{content}</View>
      {
        removable
          ? (
              <TouchableOpacity style={styles.removeBtn} onPress={() => { onRemove?.(id) }} activeOpacity={0.75}>
                <Text size={18} color="#ef4444" style={styles.removeBtnIcon}>{'\u00d7'}</Text>
              </TouchableOpacity>
            )
          : <View style={styles.removeBtnPlaceholder} />
      }
    </View>
  )
}

const SourceComp = forwardRef<SourceType, SourceProps>(({ embedded = false }, ref) => {
  const t = useI18n()
  const list = useMemo<DisplayItem[]>(() => apiSourceList.map(s => ({
    // @ts-expect-error
    name: t(`setting_basic_source_${s.id}`) || s.name,
    id: s.id,
    removable: false,
  })), [t])
  const setApiSourceId = useCallback((id: string) => {
    setApiSource(id)
  }, [])
  const userApiListRaw = useUserApiList()
  const apiStatus = useStatus()
  const apiSourceSetting = useSettingValue('common.apiSource')
  const userApiList = useMemo<DisplayItem[]>(() => {
    const getApiStatus = () => {
      let status
      if (apiStatus.status) status = t('setting_basic_source_status_success')
      else if (apiStatus.message == 'initing') status = t('setting_basic_source_status_initing')
      else status = t('setting_basic_source_status_failed')

      return status
    }
    return userApiListRaw.map(api => {
      const statusLabel = api.id == apiSourceSetting ? `[${getApiStatus()}]` : ''
      return {
        id: api.id,
        name: api.name,
        desc: [/^\d/.test(api.version) ? `v${api.version}` : api.version].filter(Boolean).join(', '),
        statusLabel,
        removable: true,
      }
    })
  }, [userApiListRaw, apiStatus, apiSourceSetting, t])

  const displayList = useMemo<DisplayItem[]>(() => {
    return embedded ? userApiList : [...list, ...userApiList]
  }, [embedded, list, userApiList])

  const modalRef = useRef<UserApiEditModalType>(null)
  const fileSelectRef = useRef<FileSelectType>(null)

  const handleShowManageModal = () => {
    modalRef.current?.show()
  }

  const handleImportLocalFile = useCallback((path: string) => {
    void readFile(path).then(async script => {
      if (script == null) throw new Error('Read file failed')
      await importUserApi(script)
      toast(t('user_api_import_success_tip'))
    }).catch((error: any) => {
      toast(t('user_api_import_failed_tip', { message: error.message }), 'long')
    })
  }, [t])

  const showAddPicker = useCallback(() => {
    if (userApiListRaw.length >= 20) {
      void tipDialog({
        message: t('user_api_max_tip'),
        btnText: t('ok'),
      })
      return
    }

    fileSelectRef.current?.show({
      title: t('user_api_import_desc'),
      dirOnly: false,
      filter: USER_API_SOURCE_FILE_EXT_RXP,
    }, handleImportLocalFile)
  }, [handleImportLocalFile, t, userApiListRaw.length])

  useImperativeHandle(ref, () => ({
    showAddPicker,
  }), [showAddPicker])

  const handleRemove = useCallback((id: string) => {
    void removeUserApi([id]).finally(() => {
      if (settingState.setting['common.apiSource'] == id) {
        if (embedded) {
          setApiSource(userApiState.list[0]?.id ?? '')
        } else {
          let backApiId = apiSourceInfo.find(api => !api.disabled)?.id
          if (!backApiId) backApiId = userApiState.list[0]?.id
          setApiSource(backApiId ?? '')
        }
      }
    })
  }, [embedded])

  const content = (
    <>
      <View style={[styles.list, embedded && styles.listEmbedded]}>
        {
          displayList.length
            ? (
                displayList.map((item, index) => (
                  <Item
                    name={item.name}
                    desc={item.desc}
                    statusLabel={item.statusLabel}
                    id={item.id}
                    key={`${item.id}_${index}`}
                    change={setApiSourceId}
                    embedded={embedded}
                    removable={item.removable}
                    isLast={index === displayList.length - 1}
                    onRemove={handleRemove}
                  />
                ))
              )
            : (
                <Text size={13} color="#6b7280" style={styles.emptyTip}>
                  {'\u5f53\u524d\u6ca1\u6709\u97f3\u6e90\uff0c\u65e0\u6cd5\u83b7\u5f97\u97f3\u4e50\u6570\u636e'}
                </Text>
              )
        }
      </View>
      {
        embedded
          ? null
          : (
              <View style={styles.btn}>
                <Button onPress={handleShowManageModal}>{t('setting_basic_source_user_api_btn')}</Button>
              </View>
            )
      }
      <UserApiEditModal ref={modalRef} />
      <FileSelect ref={fileSelectRef} />
    </>
  )

  if (embedded) {
    return <View style={styles.embeddedContainer}>{content}</View>
  }

  return (
    <SubTitle title={t('setting_basic_source')}>
      {content}
    </SubTitle>
  )
})

export default memo(SourceComp)

const styles = createStyle({
  embeddedContainer: {
    marginTop: 2,
  },
  list: {
    flexGrow: 0,
    flexShrink: 1,
  },
  listEmbedded: {
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  embeddedItem: {
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  embeddedItemLeft: {
    flex: 1,
    paddingRight: 6,
  },
  embeddedItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#edf0f3',
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnIcon: {
    lineHeight: 22,
    fontWeight: '600',
  },
  removeBtnPlaceholder: {
    width: 28,
    height: 28,
  },
  emptyTip: {
    textAlign: 'center',
    paddingVertical: 14,
  },
  btn: {
    marginTop: 10,
    flexDirection: 'row',
  },
  sourceLabel: {

  },
  sourceDesc: {

  },
  sourceStatus: {

  },
})
