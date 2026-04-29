import { useState, useRef, useEffect } from 'react'
import { View } from 'react-native'
import Input, { type InputType } from '@/components/common/Input'
import { confirmDialog, createStyle } from '@/utils/tools'
import { useI18n } from '@/lang'
import { createUserList } from '@/core/list'
import listState from '@/store/list/state'

export default ({ isEdit, onHide, defaultName, onCreated }: {
  isEdit: boolean
  onHide: () => void
  defaultName?: string
  onCreated?: (listInfo: LX.List.UserListInfo) => void | Promise<void>
}) => {
  const [text, setText] = useState('')
  const inputRef = useRef<InputType>(null)
  const isSubmittingRef = useRef(false)
  const t = useI18n()

  useEffect(() => {
    if (isEdit) {
      setText(defaultName ?? '')
      requestAnimationFrame(() => {
        inputRef.current?.focus()
      })
    }
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
    const listInfo = { id: `userlist_${Date.now()}`, name, locationUpdateTime: null }
    try {
      await createUserList(listState.userList.length, [listInfo])
      await onCreated?.(listInfo)
    } finally {
      isSubmittingRef.current = false
    }
  }

  return isEdit
    ? (
      <View style={styles.imputContainer}>
        <Input
          placeholder={t('list_create_input_placeholder')}
          value={text}
          onChangeText={setText}
          ref={inputRef}
          onBlur={handleSubmitEditing}
          onSubmitEditing={handleSubmitEditing}
          style={styles.input}
        />
      </View>
      )
    : null
}

const styles = createStyle({
  imputContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    paddingRight: 10,
    marginBottom: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    borderRadius: 12,
    textAlign: 'left',
    height: '100%',
    paddingHorizontal: 14,
  },
})
