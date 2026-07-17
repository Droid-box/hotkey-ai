import { ipcMain } from 'electron'
import { z } from 'zod'
import { IpcChannels } from '../../preload/shared/ipcChannels'
import type { ChatStreamChunk, ChatStreamEnd, ChatStreamError } from '../../preload/shared/types'
import type { AssistantStore } from '../store/assistantStore'
import { secretsStore } from '../store/secretsStore'
import { getProvider } from '../providers/registry'
import { conversationCache } from '../chat/conversationCache'

const ChatSendSchema = z.object({
  assistantId: z.string(),
  message: z.string().min(1).max(32000)
})

const ChatAbortSchema = z.object({
  assistantId: z.string()
})

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic'
}

const activeRequests = new Map<string, AbortController>()

export function registerChatIpc(store: AssistantStore): void {
  ipcMain.on(IpcChannels.chatSend, (event, rawPayload: unknown) => {
    const { assistantId, message } = ChatSendSchema.parse(rawPayload)

    const sendError = (errorMessage: string): void => {
      const payload: ChatStreamError = { assistantId, message: errorMessage }
      event.sender.send(IpcChannels.chatStreamError, payload)
    }

    const assistant = store.get(assistantId)
    if (!assistant) {
      sendError('This assistant no longer exists.')
      return
    }

    if (activeRequests.has(assistantId)) {
      sendError('A response is already in progress for this assistant.')
      return
    }

    const apiKey = secretsStore.getApiKey(assistant.provider)
    if (!apiKey) {
      sendError(
        `No API key configured for ${PROVIDER_LABELS[assistant.provider] ?? assistant.provider}. Add one under API keys in the Hotkey AI window.`
      )
      return
    }

    conversationCache.append(assistantId, { role: 'user', content: message })

    const controller = new AbortController()
    activeRequests.set(assistantId, controller)

    const provider = getProvider(assistant.provider)
    void provider.sendMessage(
      {
        apiKey,
        model: assistant.model,
        systemPrompt: assistant.systemPrompt,
        history: [...conversationCache.get(assistantId)],
        signal: controller.signal
      },
      {
        onToken: (delta) => {
          const payload: ChatStreamChunk = { assistantId, delta }
          event.sender.send(IpcChannels.chatStreamChunk, payload)
        },
        onDone: (fullText) => {
          activeRequests.delete(assistantId)
          if (fullText) {
            conversationCache.append(assistantId, { role: 'assistant', content: fullText })
          } else {
            // Aborted before any tokens arrived — drop the dangling user turn
            // so the next request doesn't send a mid-air conversation.
            conversationCache.removeLast(assistantId)
          }
          const payload: ChatStreamEnd = { assistantId, fullText }
          event.sender.send(IpcChannels.chatStreamEnd, payload)
        },
        onError: (err) => {
          activeRequests.delete(assistantId)
          // Keep history consistent: a failed exchange shouldn't leave the
          // user's message queued up to silently re-send next turn.
          conversationCache.removeLast(assistantId)
          sendError(err.message)
        }
      }
    )
  })

  ipcMain.on(IpcChannels.chatAbort, (_event, rawPayload: unknown) => {
    const { assistantId } = ChatAbortSchema.parse(rawPayload)
    activeRequests.get(assistantId)?.abort()
  })

  ipcMain.on(IpcChannels.chatReset, (_event, rawPayload: unknown) => {
    const { assistantId } = ChatAbortSchema.parse(rawPayload)
    resetConversation(assistantId)
  })
}

/** Abort any in-flight response and wipe the conversation. Used by the
 *  overlay's New-chat button (via IPC) and by pressing an assistant's
 *  shortcut again while its chat is already open. */
export function resetConversation(assistantId: string): void {
  activeRequests.get(assistantId)?.abort()
  conversationCache.clear(assistantId)
}
