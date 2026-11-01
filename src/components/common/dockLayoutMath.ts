/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

/** Use the same visibility decision for rendering and reserving space. */
export const isDockHidden = (autoHide: boolean, keyboardShown: boolean, keepPlayer: boolean) => autoHide && keyboardShown && !keepPlayer

export const visibleDockHeight = (hidden: boolean, measuredHeight: number, fallbackHeight: number) => hidden ? 0 : measuredHeight > 0 ? measuredHeight : fallbackHeight

/** Minimal scroll that fits the input and primary action, when both can fit. */
export function focusScrollOffset(offset: number, viewportHeight: number, contentHeight: number, inputTop: number, inputBottom: number, actionBottom?: number, gap = 12) {
  if (viewportHeight <= 0) return offset
  const top = inputTop - gap
  const bottom = actionBottom != null && actionBottom - top <= viewportHeight - gap ? Math.max(inputBottom, actionBottom) : inputBottom
  const delta = top < 0 ? top : Math.max(0, bottom + gap - viewportHeight)
  return Math.max(0, Math.min(Math.max(0, contentHeight - viewportHeight), offset + delta))
}
