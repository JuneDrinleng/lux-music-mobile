/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { forwardRef, useImperativeHandle, useState } from 'react'

import { MagazineSheet } from '@/components/magazine'
import { addListMusics, moveListMusics } from '@/core/list'
import { useI18n } from '@/lang'
import settingState from '@/store/setting/state'
import { toast } from '@/utils/tools'

import List from './List'

export interface SelectInfo {
  selectedList: LX.Music.MusicInfo[]
  listId: string
  isMove: boolean
  defaultNewListName?: string
}
const initSelectInfo = { selectedList: [], listId: '', isMove: false, defaultNewListName: '' }

export interface MusicMultiAddModalProps {
  onAdded?: () => void
}
export interface MusicMultiAddModalType {
  show: (info: SelectInfo) => void
}

export default forwardRef<MusicMultiAddModalType, MusicMultiAddModalProps>(({ onAdded }, ref) => {
  const t = useI18n()
  const [visible, setVisible] = useState(false)
  const [selectInfo, setSelectInfo] = useState<SelectInfo>(initSelectInfo)

  useImperativeHandle(ref, () => ({
    show(info) {
      setSelectInfo(info)
      setVisible(true)
    },
  }))

  const handleClose = () => {
    setVisible(false)
    requestAnimationFrame(() => {
      setSelectInfo({ ...selectInfo, selectedList: [], defaultNewListName: '' })
    })
  }

  const handleSelect = (listInfo: LX.List.MyListInfo) => {
    setVisible(false)
    if (selectInfo.isMove) {
      void moveListMusics(selectInfo.listId, listInfo.id,
        [...selectInfo.selectedList],
        settingState.setting['list.addMusicLocationType'],
      ).then(() => {
        onAdded?.()
        toast(t('list_edit_action_tip_move_success'))
      }).catch(() => {
        toast(t('list_edit_action_tip_move_failed'))
      })
    } else {
      void addListMusics(listInfo.id,
        [...selectInfo.selectedList],
        settingState.setting['list.addMusicLocationType'],
      ).then(() => {
        onAdded?.()
        toast(t('list_edit_action_tip_add_success'))
      }).catch(() => {
        toast(t('list_edit_action_tip_add_failed'))
      })
    }
  }
  const handleCreated = async(listInfo: LX.List.UserListInfo) => {
    setVisible(false)
    try {
      await addListMusics(listInfo.id,
        [...selectInfo.selectedList],
        settingState.setting['list.addMusicLocationType'],
      )
      onAdded?.()
      toast(t('list_edit_action_tip_add_success'))
    } catch {
      toast(t('list_edit_action_tip_add_failed'))
    }
  }

  const count = selectInfo.selectedList.length
  const isMove = selectInfo.isMove

  return (
    <MagazineSheet
      visible={visible && count > 0}
      onClose={handleClose}
      heightRatio={0.78}
      eyebrow={t(isMove ? 'sheet_move_eyebrow' : 'sheet_add_eyebrow')}
      title={t(isMove ? 'list_add_title_first_move' : 'list_add_title_first_add')}
      meta={t('sheet_add_meta')}
      figure={{ value: String(count), unit: t('library_tracks_unit') }}
      sectionLabel={t('me_playlist_list')}
    >
      {count
        ? (
          <List
            listId={selectInfo.listId}
            onPress={handleSelect}
            defaultNewListName={selectInfo.defaultNewListName}
            onCreated={isMove ? undefined : handleCreated}
          />
          )
        : null}
    </MagazineSheet>
  )
})
