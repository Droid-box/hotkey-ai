import OpenAI from 'openai'
import type { AIProvider, SendMessageParams, StreamCallbacks } from './types'

// The OpenAI models endpoint mixes chat models in with audio, image,
// embedding, etc. — keep only ids that make sense in a chat dropdown.
const CHAT_MODEL_PATTERN = /^(gpt-|chatgpt-|o\d)/
const NON_CHAT_TERMS =
  /(audio|realtime|transcribe|tts|whisper|embed|moderation|image|dall-e|davinci|babbage|instruct|search|codex)/

export function isChatModelId(id: string): boolean {
  return CHAT_MODEL_PATTERN.test(id) && !NON_CHAT_TERMS.test(id)
}

export const openaiProvider: AIProvider = {
  id: 'openai',

  async validateApiKey(apiKey: string): Promise<void> {
    const client = new OpenAI({ apiKey, timeout: 10000, maxRetries: 0 })
    await client.models.list()
  },

  async listModels(apiKey: string): Promise<string[]> {
    const client = new OpenAI({ apiKey, timeout: 15000, maxRetries: 0 })
    const models: { id: string; created: number }[] = []
    for await (const model of client.models.list()) {
      if (isChatModelId(model.id)) models.push({ id: model.id, created: model.created })
    }
    return models.sort((a, b) => b.created - a.created).map((m) => m.id)
  },

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
