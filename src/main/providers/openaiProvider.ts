import OpenAI from 'openai'
import type { AIProvider, SendMessageParams, StreamCallbacks } from './types'

export const openaiProvider: AIProvider = {
  id: 'openai',

  async sendMessage(params: SendMessageParams, callbacks: StreamCallbacks): Promise<void> {
    const { apiKey, model, systemPrompt, history, signal } = params
    let fullText = ''

    try {
      const client = new OpenAI({ apiKey })
      const stream = await client.chat.completions.create(
        {
          model,
          stream: true,
          messages: [
            ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
            ...history
          ]
        },
        { signal }
      )

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content
        if (delta) {
          fullText += delta
          callbacks.onToken(delta)
        }
      }
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
