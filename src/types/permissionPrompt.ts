// Lux Proprietary
export type PermissionPromptAction = 'cancel' | 'confirm' | 'extra'

export interface PermissionPromptPayload {
  requestId: string
  title: string
  message: string
  cancelText: string
  confirmText: string
  extraText?: string
  bgHide?: boolean
}
