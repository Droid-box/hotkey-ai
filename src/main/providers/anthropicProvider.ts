import Anthropic from '@anthropic-ai/sdk'
import type { AIProvider, SendMessageParams, StreamCallbacks } from './types'

const MAX_TOKENS = 4096

export const anthropicProvider: AIProvider = {
  id: 'anthropic',

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
