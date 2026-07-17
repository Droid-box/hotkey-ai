import type { ChatMessage } from '../../preload/shared/types'

// MVP: in-memory only, cleared on app restart. Persisting to JSONL per
// assistant is a planned fast-follow.
const conversations = new Map<string, ChatMessage[]>()

export const conversationCache = {
  get(assistantId: string): ChatMessage[] {
    return conversations.get(assistantId) ?? []
  },

  append(assistantId: string, message: ChatMessage): void {
    const history = conversations.get(assistantId)
    if (history) {
      history.push(message)
    } else {
      conversations.set(assistantId, [message])
    }
  },

  removeLast(assistantId: string): void {
    conversations.get(assistantId)?.pop()
  },

  clear(assistantId: string): void {
    conversations.delete(assistantId)
  }
}
