import { useRef, useImperativeHandle, forwardRef } from 'react'
import Modal, { type MusicMultiAddModalType as ModalType, type MusicMultiAddModalProps as ModalProps, type SelectInfo } from './MusicMultiAddModal'

export interface MusicAddModalProps {
  onAdded?: ModalProps['onAdded']
}
export interface MusicMultiAddModalType {
  show: (info: SelectInfo) => void
}

export default forwardRef<MusicMultiAddModalType, MusicAddModalProps>(({ onAdded }, ref) => {
  const musicMultiAddModalRef = useRef<ModalType>(null)

  useImperativeHandle(ref, () => ({
    show(listInfo) {
      musicMultiAddModalRef.current?.show(listInfo)
    },
  }))

  return <Modal ref={musicMultiAddModalRef} onAdded={onAdded} />
})
