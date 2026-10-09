/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

import { useCallback } from 'react'
import Text from '@/components/common/Text'
import { View } from 'react-native'
import { confirmDialog, createStyle } from '@/utils/tools'
import { useI18n } from '@/lang'
import { useUserApiList, state as userApiState } from '@/store/userApi'
import { useSettingValue } from '@/store/setting/hook'
import { removeUserApi, setUserApiAllowShowUpdateAlert } from '@/core/userApi'
import { Checkbox, Hairline, TextButton } from '@/components/magazine'
import settingState from '@/store/setting/state'
import apiSourceInfo from '@/utils/musicSdk/api-source-info'
import { setApiSource } from '@/core/apiSource'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'

const formatVersionName = (version: string) => {
  return /^\d/.test(version) ? `v${version}` : version
}

const ListItem = ({ item, activeId, onRemove, onChangeAllowShowUpdateAlert, last }: {
  item: LX.UserApi.UserApiInfo
  activeId: string
  onRemove: (id: string, name: string) => void
  onChangeAllowShowUpdateAlert: (id: string, enabled: boolean) => void
  last: boolean
}) => {
  const styles = useStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const t = useI18n()
  const metaParts = [
    item.version ? formatVersionName(item.version) : null,
    item.author || null,
    item.description || null,
  ].filter(Boolean)

  return (
    <View>
      <View style={[styles.listItem, activeId == item.id ? { opacity: 1 } : null]}>
        <View style={styles.listItemLeft}>
          <Text size={15} color={r.ink} style={styles.name}>{item.name}</Text>
          {metaParts.length
            ? <Text size={12} color={r.muted} style={styles.meta}>{metaParts.join(' · ')}</Text>
            : null}
          <View style={styles.checkRow}>
            <Checkbox
              checked={item.allowShowUpdateAlert}
              onChange={(check) => { onChangeAllowShowUpdateAlert(item.id, check) }}
            />
            <Text size={12} color={r.muted}>{t('user_api_allow_show_update_alert')}</Text>
          </View>
        </View>
        <TextButton
          label={t('user_api_remove')}
          danger
          onPress={() => { onRemove(item.id, item.name) }}
        />
      </View>
      {last ? null : <Hairline />}
    </View>
  )
}

export default () => {
  const styles = useStyles()
  const userApiList = useUserApiList()
  const apiSource = useSettingValue('common.apiSource')
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const t = useI18n()

  const handleRemove = useCallback(async(id: string, name: string) => {
    const confirm = await confirmDialog({
      message: global.i18n.t('user_api_remove_tip', { name }),
      cancelButtonText: global.i18n.t('cancel_button_text_2'),
      confirmButtonText: global.i18n.t('confirm_button_text'),
      bgClose: false,
      confirmDanger: true,
    })
    if (!confirm) return
    void removeUserApi([id]).finally(() => {
      if (settingState.setting['common.apiSource'] == id) {
        let backApiId = apiSourceInfo.find(api => !api.disabled)?.id
        if (!backApiId) backApiId = userApiState.list[0]?.id
        setApiSource(backApiId ?? '')
      }
    })
  }, [])
  const handleChangeAllowShowUpdateAlert = useCallback((id: string, enabled: boolean) => {
    void setUserApiAllowShowUpdateAlert(id, enabled)
  }, [])

  if (!userApiList.length) {
    return <Text style={styles.tipText} color={r.muted}>{t('user_api_empty')}</Text>
  }

  return (
    <View>
      {userApiList.map((item, index) => (
        <ListItem
          key={item.id}
          item={item}
          activeId={apiSource}
          onRemove={handleRemove}
          onChangeAllowShowUpdateAlert={handleChangeAllowShowUpdateAlert}
          last={index === userApiList.length - 1}
        />
      ))}
    </View>
  )
}

const useStyles = sharedLuxStyles(() => createStyle({
  listItem: {
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  listItemLeft: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  name: {
    fontWeight: '700',
  },
  meta: {
    lineHeight: 16,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    minHeight: 32,
  },
  tipText: {
    paddingVertical: 18,
    textAlign: 'center',
  },
}))
