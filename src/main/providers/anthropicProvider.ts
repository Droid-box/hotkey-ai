import Anthropic from '@anthropic-ai/sdk'
import type { AIProvider, SendMessageParams, StreamCallbacks } from './types'

const MAX_TOKENS = 4096

export const anthropicProvider: AIProvider = {
  id: 'anthropic',

  async validateApiKey(apiKey: string): Promise<void> {
    const client = new Anthropic({ apiKey, timeout: 10000, maxRetries: 0 })
    await client.models.list()
  },

  async listModels(apiKey: string): Promise<string[]> {
    const client = new Anthropic({ apiKey, timeout: 15000, maxRetries: 0 })
    const ids: string[] = []
    // Already chat-only and newest-first — no filtering needed.
    for await (const model of client.models.list()) ids.push(model.id)
    return ids
  },

  async sendMessage(params: SendMessageParams, callbacks: StreamCallbacks): Promise<void> {
    const { apiKey, model, systemPrompt, history, signal } = params
    let fullText = ''

    try {
      const client = new Anthropic({ apiKey })
      const stream = client.messages.stream(
        {
          model,
          max_tokens: MAX_TOKENS,
          ...(systemPrompt ? { system: systemPrompt } : {}),
          messages: history
        },
        { signal }
      )

      stream.on('text', (delta) => {
        fullText += delta
        callbacks.onToken(delta)
      })

      await stream.finalMessage()
      callbacks.onDone(fullText)
    } catch (err) {
      // An abort isn't a failure — surface whatever streamed so far as the result.
      if (signal.aborted) {
        callbacks.onDone(fullText)
        return
      }
      callbacks.onError(err instanceof Error ? err : new Error(String(err)))
    }
  }
}
