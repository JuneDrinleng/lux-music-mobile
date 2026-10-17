/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

// 这个文件导出的方法将暴露给服务端调用，第一个参数固定为当前 socket 对象
import { getSocketSession, isCurrentSession, isSessionTogetherNegotiated } from '../../session'
import { emitTogetherPush } from './pushBus'

type Handler = LX.Sync.ClientSyncTogetherActions extends infer A
  ? { [K in keyof A]: A[K] extends (...args: infer P) => infer R ? (socket: LX.Sync.Socket, ...args: P) => R : never }
  : never

const handler: Handler = {
  async 'together:onRoomState'(socket, push) {
    const sessionId = getSocketSession(socket)?.id
    if (!isCurrentSession(sessionId) || !isSessionTogetherNegotiated()) return
    emitTogetherPush({ sessionId: sessionId!, type: 'roomState', push })
  },
  async 'together:onMemberChanged'(socket, push) {
    const sessionId = getSocketSession(socket)?.id
    if (!isCurrentSession(sessionId) || !isSessionTogetherNegotiated()) return
    emitTogetherPush({ sessionId: sessionId!, type: 'memberChanged', push })
  },
  async 'together:onHostChanged'(socket, push) {
    const sessionId = getSocketSession(socket)?.id
    if (!isCurrentSession(sessionId) || !isSessionTogetherNegotiated()) return
    emitTogetherPush({ sessionId: sessionId!, type: 'hostChanged', push })
  },
  async 'together:onRoomClosed'(socket, push) {
    const sessionId = getSocketSession(socket)?.id
    if (!isCurrentSession(sessionId) || !isSessionTogetherNegotiated()) return
    emitTogetherPush({ sessionId: sessionId!, type: 'roomClosed', push })
  },
}

export default handler
