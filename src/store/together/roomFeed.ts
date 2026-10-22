/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { callTogether } from '@/plugins/sync/client/modules/together/api'
import { createRoomFeed } from '@/core/together/roomFeed'

export const togetherRoomFeed = createRoomFeed(callTogether)
