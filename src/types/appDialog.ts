/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

// Lux Proprietary
export type AppDialogAction = 'cancel' | 'confirm' | 'extra'

export interface AppDialogPayload {
  requestId: string
  title: string
  message: string
  cancelText: string
  confirmText: string
  extraText?: string
  showConfirm?: boolean
  bgHide?: boolean
  eyebrow?: string
  eyebrowDanger?: boolean
  confirmDanger?: boolean
  extraDanger?: boolean
}
