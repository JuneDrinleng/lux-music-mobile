/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

// Lux Proprietary
import { useCallback, useEffect, useRef, useState } from 'react'
import PromptDialog, { type PromptDialogType } from '@/components/common/PromptDialog'
import { type AppDialogAction, type AppDialogPayload } from '@/types/appDialog'

export default () => {
  const dialogRef = useRef<PromptDialogType>(null)
  const payloadRef = useRef<AppDialogPayload | null>(null)
  const resolvedRef = useRef(false)
  const [payload, setPayload] = useState<AppDialogPayload | null>(null)

  const emitResult = useCallback((action: AppDialogAction) => {
    const currentPayload = payloadRef.current
    if (!currentPayload || resolvedRef.current) return
    resolvedRef.current = true
    global.app_event.appDialogResult(currentPayload.requestId, action)
  }, [])

  const handleCancel = useCallback(() => {
    emitResult('cancel')
  }, [emitResult])

  const handleConfirm = useCallback(async() => {
    emitResult('confirm')
    return true
  }, [emitResult])

  const handleHide = useCallback(() => {
    if (!resolvedRef.current) emitResult('cancel')
    payloadRef.current = null
    setPayload(null)
  }, [emitResult])

  useEffect(() => {
    Reflect.set(global.lx, 'appDialogReady', true)
    const handleShow = (nextPayload: AppDialogPayload) => {
      payloadRef.current = nextPayload
      resolvedRef.current = false
      setPayload(nextPayload)
      requestAnimationFrame(() => {
        dialogRef.current?.show('')
      })
    }
    global.app_event.on('showAppDialog', handleShow)
    return () => {
      Reflect.set(global.lx, 'appDialogReady', false)
      global.app_event.off('showAppDialog', handleShow)
    }
  }, [])

  if (!payload) return null

  return (
    <PromptDialog
      ref={dialogRef}
      title={payload.title}
      message={payload.message}
      cancelText={payload.cancelText}
      confirmText={payload.confirmText}
      showInput={false}
      showConfirm={payload.showConfirm ?? true}
      bgHide={payload.bgHide ?? true}
      onCancel={handleCancel}
      onConfirm={handleConfirm}
      onHide={handleHide}
    />
  )
}
