/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

/** Membership changes invalidate pending reads even if the same room is rejoined. */
export const createRoomRevision = () => {
  let revision = 0
  return {
    capture: () => revision,
    invalidate: () => { revision += 1 },
    accepts: (token: number, current: { roomId: string, version: number } | null, incoming: { roomId: string, version: number } | null) => (
      token == revision && (!current || !incoming || (incoming.roomId != current.roomId || incoming.version >= current.version))
    ),
  }
}
