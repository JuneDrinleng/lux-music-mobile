import { useRef, useImperativeHandle, forwardRef } from 'react'
import Modal, { type MusicAddModalType as ModalType, type MusicAddModalProps as ModalProps, type SelectInfo } from './MusicAddModal'

export interface MusicAddModalProps {
  onAdded?: ModalProps['onAdded']
}
export interface MusicAddModalType {
  show: (info: SelectInfo) => void
}

export default forwardRef<MusicAddModalType, MusicAddModalProps>(({ onAdded }, ref) => {
  const musicAddModalRef = useRef<ModalType>(null)

  useImperativeHandle(ref, () => ({
    show(listInfo) {
      musicAddModalRef.current?.show(listInfo)
    },
  }))

  return <Modal ref={musicAddModalRef} onAdded={onAdded} />
})
