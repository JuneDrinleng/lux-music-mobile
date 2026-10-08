/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

export const PLAYLIST_LIFT_SCALE = 1.02

export const liftScaleFitsGrid = (scale: number, cardWidthRatio = 0.484) => {
  if (!(scale > 0) || !(cardWidthRatio > 0) || cardWidthRatio >= 1) return false
  return cardWidthRatio * scale <= 1 - cardWidthRatio + 0.0001
}

export interface TouchPagePoint {
  pageX: number
  pageY: number
}

export interface TouchPointEvent {
  pageX?: number
  pageY?: number
  touches?: Array<{ pageX?: number, pageY?: number } | null | undefined>
  changedTouches?: Array<{ pageX?: number, pageY?: number } | null | undefined>
}

const finitePoint = (pageX: number | undefined, pageY: number | undefined): TouchPagePoint | null => {
  if (typeof pageX != 'number' || typeof pageY != 'number') return null
  if (!Number.isFinite(pageX) || !Number.isFinite(pageY)) return null
  return { pageX, pageY }
}

const pointFromList = (list: TouchPointEvent['touches']): TouchPagePoint | null => {
  if (!list) return null
  for (const touch of list) {
    const point = finitePoint(touch?.pageX, touch?.pageY)
    if (point) return point
  }
  return null
}

/** Raw touch events keep coordinates on touches/changedTouches. Responder events use pageX/pageY. */
export const readTouchPagePoint = (nativeEvent: TouchPointEvent | null | undefined): TouchPagePoint | null => {
  if (!nativeEvent) return null
  return pointFromList(nativeEvent.changedTouches) ??
    pointFromList(nativeEvent.touches) ??
    finitePoint(nativeEvent.pageX, nativeEvent.pageY)
}

export interface PlaylistGestureFlags {
  active: boolean
  settling: boolean
  pressLive: boolean
  moved: boolean
  panOwned: boolean
  fromIndex: number
  toIndex: number
}

export type PlaylistGestureEndKind = 'release' | 'cancel' | 'terminate' | 'safety' | 'newPress'

export interface PlaylistGestureDecision {
  resetVisual: boolean
  commitOrder: boolean
  openList: boolean
  recoverStuck: boolean
}

const idleDecision = (): PlaylistGestureDecision => ({
  resetVisual: false,
  commitOrder: false,
  openList: false,
  recoverStuck: false,
})

/**
 * Every path that can leave a card lifted must set resetVisual.
 * safety / newPress drop the lift without writing order: the finger-up was lost.
 * release / cancel / terminate write the order when the slot actually changed.
 */
export const decidePlaylistGestureEnd = (
  flags: PlaylistGestureFlags,
  kind: PlaylistGestureEndKind,
): PlaylistGestureDecision => {
  if (kind == 'newPress') {
    // A settle animation already owns the reset. A still-lifted active drag
    // means the previous finger-up never arrived.
    if (flags.settling && !flags.active) return idleDecision()
    const recoverStuck = flags.active
    return {
      resetVisual: recoverStuck,
      commitOrder: false,
      openList: false,
      recoverStuck,
    }
  }
  if (kind == 'safety') {
    if (!flags.active && !flags.settling) return idleDecision()
    return { resetVisual: true, commitOrder: false, openList: false, recoverStuck: false }
  }
  if (!flags.active && !flags.settling) {
    return {
      resetVisual: false,
      commitOrder: false,
      openList: kind == 'release' && flags.pressLive && !flags.moved,
      recoverStuck: false,
    }
  }
  if (flags.settling) {
    return { resetVisual: true, commitOrder: false, openList: false, recoverStuck: false }
  }
  const orderChanged = flags.fromIndex != flags.toIndex && flags.fromIndex >= 0 && flags.toIndex >= 0
  const commitOrder = orderChanged && (kind == 'release' || kind == 'cancel' || kind == 'terminate')
  return { resetVisual: true, commitOrder, openList: false, recoverStuck: false }
}
