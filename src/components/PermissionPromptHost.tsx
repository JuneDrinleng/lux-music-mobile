/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { useCallback, useEffect, useRef, useState } from 'react'
import PromptDialog, { type PromptDialogType } from '@/components/common/PromptDialog'
import { type PermissionPromptAction, type PermissionPromptPayload } from '@/types/permissionPrompt'

export default () => {
  const dialogRef = useRef<PromptDialogType>(null)
  const payloadRef = useRef<PermissionPromptPayload | null>(null)
  const resolvedRef = useRef(false)
  const [payload, setPayload] = useState<PermissionPromptPayload | null>(null)

  const emitResult = useCallback((action: PermissionPromptAction) => {
    const currentPayload = payloadRef.current
    if (!currentPayload || resolvedRef.current) return
    resolvedRef.current = true
    global.app_event.permissionPromptResult(currentPayload.requestId, action)
  }, [])

  const handleCancel = useCallback(() => {
    emitResult('cancel')
  }, [emitResult])

  const handleConfirm = useCallback(async() => {
    emitResult('confirm')
    return true
  }, [emitResult])

  const handleExtra = useCallback(async() => {
    emitResult('extra')
    return true
  }, [emitResult])

  const handleHide = useCallback(() => {
    if (!resolvedRef.current) emitResult('cancel')
    payloadRef.current = null
    setPayload(null)
  }, [emitResult])

  useEffect(() => {
    Reflect.set(global.lx, 'permissionPromptReady', true)
    const handleShow = (nextPayload: PermissionPromptPayload) => {
      payloadRef.current = nextPayload
      resolvedRef.current = false
      setPayload(nextPayload)
      requestAnimationFrame(() => {
        dialogRef.current?.show('')
      })
    }
    global.app_event.on('showPermissionPrompt', handleShow)
    return () => {
      Reflect.set(global.lx, 'permissionPromptReady', false)
      global.app_event.off('showPermissionPrompt', handleShow)
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
      extraText={payload.extraText}
      showInput={false}
      bgHide={payload.bgHide ?? false}
      onCancel={handleCancel}
      onConfirm={handleConfirm}
      onExtra={handleExtra}
      onHide={handleHide}
    />
  )
}
