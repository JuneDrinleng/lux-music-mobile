import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import Dialog, { type DialogType } from '@/components/common/Dialog'
import PlaylistPickerDialog from '@/components/PlaylistPicker/PlaylistPickerDialog'
import { toast } from '@/utils/tools'
import { useI18n } from '@/lang'
import { addListMusics, moveListMusics } from '@/core/list'
import settingState from '@/store/setting/state'

export interface SelectInfo {
  selectedList: LX.Music.MusicInfo[]
  listId: string
  isMove: boolean
  defaultNewListName?: string
  // single: boolean
}
const initSelectInfo = { selectedList: [], listId: '', isMove: false, defaultNewListName: '' }

export interface MusicMultiAddModalProps {
  onAdded?: () => void
  // onRename: (listInfo: LX.List.UserListInfo) => void
  // onImport: (listInfo: LX.List.MyListInfo, index: number) => void
  // onExport: (listInfo: LX.List.MyListInfo, index: number) => void
  // onSync: (listInfo: LX.List.UserListInfo) => void
  // onRemove: (listInfo: LX.List.UserListInfo) => void
}
export interface MusicMultiAddModalType {
  show: (info: SelectInfo) => void
}

export default forwardRef<MusicMultiAddModalType, MusicMultiAddModalProps>(({ onAdded }, ref) => {
  const t = useI18n()
  const dialogRef = useRef<DialogType>(null)
  const [selectInfo, setSelectInfo] = useState<SelectInfo>(initSelectInfo)

  useImperativeHandle(ref, () => ({
    show(selectInfo) {
      setSelectInfo(selectInfo)

      requestAnimationFrame(() => {
        dialogRef.current?.setVisible(true)
      })
    },
  }))

  const handleHide = () => {
    requestAnimationFrame(() => {
      setSelectInfo({ ...selectInfo, selectedList: [], defaultNewListName: '' })
    })
  }

  const handleSelect = (listInfo: LX.List.MyListInfo) => {
    dialogRef.current?.setVisible(false)
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
    dialogRef.current?.setVisible(false)
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

  return (
    <Dialog ref={dialogRef} onHide={handleHide} title={t(selectInfo.isMove ? 'list_add_title_first_move' : 'add_to')} height="72%">
      {
        selectInfo.selectedList.length
          ? (
            <PlaylistPickerDialog
              summaryTitle={
                selectInfo.selectedList.length === 1
                  ? selectInfo.selectedList[0].name
                  : `${selectInfo.selectedList.length} ${t('me_songs')}`
              }
              summarySubtitle={`${t(selectInfo.isMove ? 'list_multi_add_title_first_move' : 'list_multi_add_title_first_add')} ${selectInfo.selectedList.length} ${t('list_multi_add_title_last')}`}
              summaryNote={selectInfo.defaultNewListName ? `${t('list_create')}: ${selectInfo.defaultNewListName}` : undefined}
              coverUrl={selectInfo.selectedList[0]?.meta.picUrl ?? null}
              count={selectInfo.selectedList.length}
              listId={selectInfo.listId}
              actionLabel={t(selectInfo.isMove ? 'list_add_title_first_move' : 'list_add_title_first_add')}
              defaultNewListName={selectInfo.defaultNewListName}
              onSelect={handleSelect}
              onCreated={selectInfo.isMove ? undefined : handleCreated}
            />
            )
          : null
      }
    </Dialog>
  )
})

