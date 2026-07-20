import { ipcMain } from 'electron'
import { z } from 'zod'
import { IpcChannels } from '../../preload/shared/ipcChannels'
import type { ChatMessage, ConversationList } from '../../preload/shared/types'
import { conversationStore } from '../chat/conversationStore'

const AssistantSchema = z.object({ assistantId: z.string() })
const ConversationSchema = z.object({ assistantId: z.string(), conversationId: z.string() })

export function registerConversationsIpc(): void {
  ipcMain.handle(IpcChannels.conversationsList, (_event, raw: unknown): ConversationList => {
    return conversationStore.list(AssistantSchema.parse(raw).assistantId)
  })

  // Open a past thread: make it active and return its messages.
  ipcMain.handle(IpcChannels.conversationsOpen, (_event, raw: unknown): ChatMessage[] => {
    const { assistantId, conversationId } = ConversationSchema.parse(raw)
    conversationStore.setActive(assistantId, conversationId)
    return conversationStore.getMessages(assistantId, conversationId)
  })

  ipcMain.handle(IpcChannels.conversationsDelete, (_event, raw: unknown): ConversationList => {
    const { assistantId, conversationId } = ConversationSchema.parse(raw)
    conversationStore.deleteConversation(assistantId, conversationId)
    return conversationStore.list(assistantId)
  })
}
