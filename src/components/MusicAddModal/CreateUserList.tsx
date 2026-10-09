/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { useEffect, useRef, useState } from 'react'
import { View } from 'react-native'

import { UnderlineInput } from '@/components/magazine'
import { createUserList } from '@/core/list'
import { useI18n } from '@/lang'
import listState from '@/store/list/state'
import { confirmDialog } from '@/utils/tools'

export default ({ isEdit, onHide, defaultName, onCreated }: {
  isEdit: boolean
  onHide: () => void
  defaultName?: string
  onCreated?: (listInfo: LX.List.UserListInfo) => void | Promise<void>
}) => {
  const [text, setText] = useState('')
  const isSubmittingRef = useRef(false)
  const t = useI18n()

  useEffect(() => {
    if (isEdit) setText(defaultName ?? '')
  }, [defaultName, isEdit])

  const handleSubmitEditing = async() => {
    if (isSubmittingRef.current) return
    isSubmittingRef.current = true
    onHide()
    const name = text.trim()
    if (!name.length || (listState.userList.some(l => l.name == name) && !(await confirmDialog({
      message: global.i18n.t('list_duplicate_tip'),
    })))) {
      isSubmittingRef.current = false
      return
    }
    const now = Date.now()
    const listInfo = { id: `userlist_${now}`, name, locationUpdateTime: now }
    try {
      await createUserList(listState.userList.length, [listInfo])
      await onCreated?.(listInfo)
    } finally {
      isSubmittingRef.current = false
    }
  }

  if (!isEdit) return null

  return (
    <View style={{ minHeight: 56, justifyContent: 'center', paddingVertical: 8 }}>
      <UnderlineInput
        value={text}
        onChangeText={setText}
        placeholder={t('list_create_input_placeholder')}
        autoFocus
        onBlur={() => { void handleSubmitEditing() }}
        onSubmitEditing={() => { void handleSubmitEditing() }}
        returnKeyType="done"
      />
    </View>
  )
}
