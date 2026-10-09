export interface PlaylistDragLayoutBox {
  x: number
  y: number
  width: number
  height: number
}

export const getCardDisplayIndex = (index: number, sourceIndex: number, targetIndex: number) => {
  if (targetIndex === sourceIndex) return index
  if (index === sourceIndex) return targetIndex
  if (sourceIndex < targetIndex) {
    return index > sourceIndex && index <= targetIndex ? index - 1 : index
  }
  return index >= targetIndex && index < sourceIndex ? index + 1 : index
}

export const shiftBetweenSlots = (
  layouts: PlaylistDragLayoutBox[],
  index: number,
  sourceIndex: number,
  targetIndex: number,
) => {
  const fromBox = layouts[index]
  const toBox = layouts[getCardDisplayIndex(index, sourceIndex, targetIndex)]
  if (!fromBox || !toBox) return { x: 0, y: 0 }
  return {
    x: Math.round(toBox.x - fromBox.x),
    y: Math.round(toBox.y - fromBox.y),
  }
}

export const findNearestSlotIndex = (
  layouts: PlaylistDragLayoutBox[],
  centerX: number,
  centerY: number,
  currentIndex: number,
  hysteresis = 18,
) => {
  if (!layouts.length) return 0
  const distanceTo = (index: number) => {
    const box = layouts[index]
    if (!box || box.width <= 0 || box.height <= 0) return Number.POSITIVE_INFINITY
    const dx = centerX - (box.x + box.width / 2)
    const dy = centerY - (box.y + box.height / 2)
    return dx * dx + dy * dy
  }
  let best = 0
  let bestDistance = distanceTo(0)
  for (let index = 1; index < layouts.length; index++) {
    const distance = distanceTo(index)
    if (distance < bestDistance) {
      best = index
      bestDistance = distance
    }
  }
  if (best === currentIndex || currentIndex < 0 || currentIndex >= layouts.length) return best
  const currentDistance = distanceTo(currentIndex)
  if (currentDistance - bestDistance < hysteresis * hysteresis) return currentIndex
  return best
}

export const clampNumber = (value: number, min: number, max: number) => {
  if (max < min) return min
  if (value < min) return min
  if (value > max) return max
  return value
}

const LIST_ROW_HEIGHT = 73
const LIST_ROW_GAP = 1
const GRID_TEXT_BLOCK = 36
const GRID_ROW_GAP = 14

export const fallbackPlaylistLayout = (
  index: number,
  isListMode: boolean,
  sectionWidth: number,
): PlaylistDragLayoutBox => {
  const width = Math.max(sectionWidth, 1)
  if (isListMode) {
    return {
      x: 0,
      y: index * (LIST_ROW_HEIGHT + LIST_ROW_GAP),
      width,
      height: LIST_ROW_HEIGHT,
    }
  }
  const cardWidth = width * 0.484
  const cardHeight = cardWidth + GRID_TEXT_BLOCK
  const column = index % 2
  const row = Math.floor(index / 2)
  return {
    x: column === 0 ? 0 : width - cardWidth,
    y: row * (cardHeight + GRID_ROW_GAP),
    width: cardWidth,
    height: cardHeight,
  }
}
