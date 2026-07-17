import type { ChatMessage, ProviderId } from '../../preload/shared/types'

export interface StreamCallbacks {
  onToken: (delta: string) => void
  /** Also called with the partial text when the request is aborted mid-stream. */
  onDone: (fullText: string) => void
  onError: (err: Error) => void
}

export interface SendMessageParams {
  apiKey: string
  model: string
  systemPrompt: string
  history: ChatMessage[]
  signal: AbortSignal
}

export interface AIProvider {
  id: ProviderId
  sendMessage(params: SendMessageParams, callbacks: StreamCallbacks): Promise<void>
}
