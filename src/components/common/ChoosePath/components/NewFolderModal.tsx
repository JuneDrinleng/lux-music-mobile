/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { MagDialog, UnderlineInput } from '@/components/magazine'
import { toast } from '@/utils/tools'
import { mkdir } from '@/utils/fs'
import { useI18n } from '@/lang'
import type { PathItem } from './ListItem'

const filterFileName = /[\\/:*?#"<>|]/

export interface NewFolderType {
  show: (path: string) => void
}

export default forwardRef<NewFolderType, { onRefreshDir: (dir: string) => Promise<PathItem[]> }>(({ onRefreshDir }, ref) => {
  const t = useI18n()
  const pathRef = useRef('')
  const [visible, setVisible] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  useImperativeHandle(ref, () => ({
    show(path) {
      pathRef.current = path
      setName('')
      setError('')
      setVisible(true)
    },
  }))

  const handleCancel = () => {
    setVisible(false)
    setName('')
    setError('')
  }

  const handleConfirm = () => {
    const text = name.trim()
    if (!text) return
    if (filterFileName.test(text)) {
      setError(t('create_new_folder_error_tip'))
      toast(t('create_new_folder_error_tip'), 'long')
      return
    }
    const newPath = `${pathRef.current}/${text}`
    mkdir(newPath).then(() => {
      void onRefreshDir(pathRef.current).then((list) => {
        const target = list.find(item => item.name == text)
        if (target) void onRefreshDir(target.path)
      })
      handleCancel()
    }).catch((err: any) => {
      toast('Create failed: ' + (err.message as string))
    })
  }

  return (
    <MagDialog
      visible={visible}
      onClose={handleCancel}
      eyebrow={t('choose_path_new_folder_eyebrow')}
      title={t('create_new_folder')}
      cancelLabel={t('cancel')}
      confirmLabel={t('confirm')}
      onCancel={handleCancel}
      onConfirm={handleConfirm}
      bgHide={false}
    >
      <UnderlineInput
        value={name}
        onChangeText={(text) => {
          setName(text)
          setError('')
        }}
        placeholder={t('create_new_folder_tip')}
        error={error}
        autoFocus
        onSubmitEditing={handleConfirm}
      />
    </MagDialog>
  )
})
