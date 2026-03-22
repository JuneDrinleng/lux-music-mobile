export type AppDialogAction = 'cancel' | 'confirm'

export interface AppDialogPayload {
  requestId: string
  title: string
  message: string
  cancelText: string
  confirmText: string
  showConfirm?: boolean
  bgHide?: boolean
}
