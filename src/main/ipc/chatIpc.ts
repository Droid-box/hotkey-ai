import type { WebContents } from 'electron'
import { ipcMain } from 'electron'
import { z } from 'zod'
import { IpcChannels } from '../../preload/shared/ipcChannels'
import type {
  Assistant,
  ChatStreamChunk,
  ChatStreamEnd,
  ChatStreamError
} from '../../preload/shared/types'
import type { AssistantStore } from '../store/assistantStore'
import { secretsStore } from '../store/secretsStore'
import { getProvider } from '../providers/registry'
import { conversationStore } from '../chat/conversationStore'

// After a new thread's first exchange, ask the model for a short title and
// store it (replacing the first-message fallback). Fire-and-forget; on any
// failure the fallback title stays. Runs only when the active thread has
// exactly one exchange (2 messages), so it fires once per thread.
function generateTitle(assistant: Assistant, sender: WebContents): void {
  const assistantId = assistant.id
  const conversationId = conversationStore.getActiveId(assistantId)
  if (!conversationId) return
  const messages = conversationStore.getMessages(assistantId, conversationId)
  if (messages.length !== 2) return
  const apiKey = secretsStore.getApiKey(assistant.provider)
  if (!apiKey) return

  const exchange = `User: ${messages[0].content}\n\nAssistant: ${messages[1].content}`
  void getProvider(assistant.provider).sendMessage(
    {
      apiKey,
      model: assistant.model,
      systemPrompt:
        'You write a short, specific title (3 to 6 words) summarizing a conversation. ' +
        'Reply with ONLY the title — no quotes and no trailing punctuation.',
      history: [{ role: 'user', content: `${exchange}\n\nTitle:` }],
      signal: new AbortController().signal
    },
    {
      onToken: () => {},
      onDone: (full) => {
        const title = full
          .trim()
          .replace(/^["'`]+|["'`]+$/g, '')
          .replace(/[.]+$/, '')
          .slice(0, 60)
        if (!title) return
        conversationStore.renameConversation(assistantId, conversationId, title)
        if (!sender.isDestroyed()) {
          sender.send(IpcChannels.conversationsChanged, {
            assistantId,
            list: conversationStore.list(assistantId)
          })
        }
      },
      onError: () => {
        // Keep the first-message fallback title.
      }
    }
  )
}

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

    const sendError = (errorMessage: string, action?: ChatStreamError['action']): void => {
      const payload: ChatStreamError = { assistantId, message: errorMessage, action }
      event.sender.send(IpcChannels.chatStreamError, payload)
    }

    // Keep the history sidebar in sync as the active thread gains messages,
    // reorders, or (later) gets an AI title.
    const pushConversations = (): void => {
      event.sender.send(IpcChannels.conversationsChanged, {
        assistantId,
        list: conversationStore.list(assistantId)
      })
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
        `No API key configured for ${PROVIDER_LABELS[assistant.provider] ?? assistant.provider}.`,
        'add-api-key'
      )
      return
    }

    // Append the user turn to the assistant's active thread, then send the
    // whole active-thread history to the provider.
    conversationStore.appendToActive(assistantId, { role: 'user', content: message })
    pushConversations() // new thread appears in the sidebar on its first message

    const controller = new AbortController()
    activeRequests.set(assistantId, controller)

    const provider = getProvider(assistant.provider)
    void provider.sendMessage(
      {
        apiKey,
        model: assistant.model,
        systemPrompt: assistant.systemPrompt,
        history: conversationStore.getActiveMessages(assistantId),
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
            conversationStore.appendToActive(assistantId, { role: 'assistant', content: fullText })
            generateTitle(assistant, event.sender) // AI title after first exchange
          } else {
            // Aborted before any tokens arrived — drop the dangling user turn
            // so the next request doesn't send a mid-air conversation.
            conversationStore.removeLastFromActive(assistantId)
          }
          pushConversations()
          const payload: ChatStreamEnd = { assistantId, fullText }
          event.sender.send(IpcChannels.chatStreamEnd, payload)
        },
        onError: (err) => {
          activeRequests.delete(assistantId)
          // Keep history consistent: a failed exchange shouldn't leave the
          // user's message queued up to silently re-send next turn.
          conversationStore.removeLastFromActive(assistantId)
          pushConversations()
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

/** Abort any in-flight response and start a fresh active thread. The previous
 *  thread stays in history. Used by the overlay's New-chat button (via IPC),
 *  by pressing an assistant's shortcut again while its chat is open, and by
 *  reset-chat-on-close. */
export function resetConversation(assistantId: string): void {
  activeRequests.get(assistantId)?.abort()
  conversationStore.newConversation(assistantId)
}
