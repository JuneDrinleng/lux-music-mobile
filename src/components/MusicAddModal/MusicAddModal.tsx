/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { forwardRef, useImperativeHandle, useState } from 'react'

import { MagazineSheet } from '@/components/magazine'
import { addListMusics, moveListMusics } from '@/core/list'
import { useI18n } from '@/lang'
import settingState from '@/store/setting/state'
import { toast } from '@/utils/tools'

import List from './List'
import Title from './Title'

export interface SelectInfo {
  musicInfo: LX.Music.MusicInfo | null
  listId: string
  isMove: boolean
}
const initSelectInfo = {}

export interface MusicAddModalProps {
  onAdded?: () => void
}
export interface MusicAddModalType {
  show: (info: SelectInfo) => void
}

export default forwardRef<MusicAddModalType, MusicAddModalProps>(({ onAdded }, ref) => {
  const t = useI18n()
  const [visible, setVisible] = useState(false)
  const [selectInfo, setSelectInfo] = useState<SelectInfo>(initSelectInfo as SelectInfo)

  useImperativeHandle(ref, () => ({
    show(info) {
      setSelectInfo(info)
      setVisible(true)
    },
  }))

  const handleClose = () => {
    setVisible(false)
    requestAnimationFrame(() => {
      setSelectInfo({ ...selectInfo, musicInfo: null })
    })
  }

  const handleSelect = (listInfo: LX.List.MyListInfo) => {
    setVisible(false)
    if (selectInfo.isMove) {
      void moveListMusics(selectInfo.listId, listInfo.id,
        [selectInfo.musicInfo!],
        settingState.setting['list.addMusicLocationType'],
      ).then(() => {
        onAdded?.()
        toast(t('list_edit_action_tip_move_success'))
      }).catch(() => {
        toast(t('list_edit_action_tip_move_failed'))
      })
    } else {
      void addListMusics(listInfo.id,
        [selectInfo.musicInfo!],
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
    if (selectInfo.isMove || !selectInfo.musicInfo) return
    try {
      await addListMusics(listInfo.id,
        [selectInfo.musicInfo],
        settingState.setting['list.addMusicLocationType'],
      )
      onAdded?.()
      toast(t('list_edit_action_tip_add_success'))
    } catch {
      toast(t('list_edit_action_tip_add_failed'))
    }
  }

  const isMove = selectInfo.isMove
  const musicInfo = selectInfo.musicInfo

  return (
    <MagazineSheet
      visible={visible && Boolean(musicInfo)}
      onClose={handleClose}
      heightRatio={0.78}
      eyebrow={t(isMove ? 'sheet_move_eyebrow' : 'sheet_add_eyebrow')}
      title={t(isMove ? 'list_add_title_first_move' : 'list_add_title_first_add')}
      meta={t('sheet_add_meta')}
      subject={musicInfo ? <Title musicInfo={musicInfo} isMove={isMove} /> : undefined}
      sectionLabel={t('me_playlist_list')}
    >
      {musicInfo
        ? (
          <List
            musicInfo={musicInfo}
            onPress={handleSelect}
            onCreated={isMove ? undefined : handleCreated}
          />
          )
        : null}
    </MagazineSheet>
  )
})
