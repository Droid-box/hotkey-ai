import { ipcMain } from 'electron'
import { z } from 'zod'
import { IpcChannels } from '../../preload/shared/ipcChannels'
import type { ChatStreamChunk, ChatStreamEnd, ChatStreamError } from '../../preload/shared/types'
import type { AssistantStore } from '../store/assistantStore'
import { secretsStore } from '../store/secretsStore'
import { getProvider } from '../providers/registry'

// The test chat streams through the real provider using the assistant's SAVED
// config, but its conversation is owned by the renderer and passed in with each
// request — nothing is written to conversationCache, so it never mixes with or
// persists to the assistant's actual history.
const TestChatSendSchema = z.object({
  assistantId: z.string(),
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(32000)
      })
    )
    .min(1)
    .max(200)
})

const AbortSchema = z.object({ assistantId: z.string() })

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic'
}

const activeRequests = new Map<string, AbortController>()

export function registerTestChatIpc(store: AssistantStore): void {
  ipcMain.on(IpcChannels.testChatSend, (event, rawPayload: unknown) => {
    const { assistantId, messages } = TestChatSendSchema.parse(rawPayload)

    const sendError = (message: string, action?: ChatStreamError['action']): void => {
      const payload: ChatStreamError = { assistantId, message, action }
      event.sender.send(IpcChannels.testChatStreamError, payload)
    }

    const assistant = store.get(assistantId)
    if (!assistant) {
      sendError('Save the assistant before testing it.')
      return
    }
    if (activeRequests.has(assistantId)) {
      sendError('A response is already in progress.')
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

    const controller = new AbortController()
    activeRequests.set(assistantId, controller)

    const provider = getProvider(assistant.provider)
    void provider.sendMessage(
      {
        apiKey,
        model: assistant.model,
        systemPrompt: assistant.systemPrompt,
        history: messages,
        signal: controller.signal
      },
      {
        onToken: (delta) => {
          const payload: ChatStreamChunk = { assistantId, delta }
          event.sender.send(IpcChannels.testChatStreamChunk, payload)
        },
        onDone: (fullText) => {
          activeRequests.delete(assistantId)
          const payload: ChatStreamEnd = { assistantId, fullText }
          event.sender.send(IpcChannels.testChatStreamEnd, payload)
        },
        onError: (err) => {
          activeRequests.delete(assistantId)
          sendError(err.message)
        }
      }
    )
  })

  ipcMain.on(IpcChannels.testChatAbort, (_event, rawPayload: unknown) => {
    const { assistantId } = AbortSchema.parse(rawPayload)
    activeRequests.get(assistantId)?.abort()
  })
}
