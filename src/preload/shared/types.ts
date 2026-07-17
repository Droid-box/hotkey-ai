export type ProviderId = 'openai' | 'anthropic'

export interface Assistant {
  id: string
  name: string
  systemPrompt: string
  provider: ProviderId
  model: string
  shortcut: string
  createdAt: string
  updatedAt: string
}

export type AssistantInput = Omit<Assistant, 'id' | 'createdAt' | 'updatedAt'>

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ApiKeyStatus {
  hasKey: boolean
  masked: string | null
}

export interface ApiKeyInfo {
  provider: ProviderId
  masked: string
  addedAt: string | null
}

export interface TestApiKeyResult {
  ok: boolean
  message?: string
}

export interface ModelListResult {
  models: string[]
  error: string | null
}

export interface ManagementBridge {
  appName: string
  assistants: {
    list: () => Promise<Assistant[]>
    create: (input: AssistantInput) => Promise<Assistant>
    update: (id: string, input: AssistantInput) => Promise<Assistant>
    delete: (id: string) => Promise<void>
    onUpdated: (callback: () => void) => () => void
  }
  secrets: {
    setApiKey: (provider: ProviderId, key: string) => Promise<ApiKeyStatus>
    getApiKeyStatus: (provider: ProviderId) => Promise<ApiKeyStatus>
    deleteApiKey: (provider: ProviderId) => Promise<void>
    testApiKey: (provider: ProviderId, key: string) => Promise<TestApiKeyResult>
    listApiKeys: () => Promise<ApiKeyInfo[]>
  }
  models: {
    list: (provider: ProviderId) => Promise<ModelListResult>
  }
}

// The system prompt is deliberately excluded from what the overlay sees:
// it never leaves the main process for display, only used when calling
// the provider. `assistant: null` means no assistants exist yet.
export interface OverlayConfigurePayload {
  assistant: {
    id: string
    name: string
    provider: ProviderId
    model: string
  } | null
  history: ChatMessage[]
}

export interface ChatStreamChunk {
  assistantId: string
  delta: string
}

export interface ChatStreamEnd {
  assistantId: string
  fullText: string
}

export interface ChatStreamError {
  assistantId: string
  message: string
}

export interface OverlayBridge {
  onConfigure: (callback: (payload: OverlayConfigurePayload) => void) => () => void
  close: () => void
  sendMessage: (assistantId: string, message: string) => void
  abort: (assistantId: string) => void
  resetChat: (assistantId: string) => void
  copyText: (text: string) => void
  onStreamChunk: (callback: (payload: ChatStreamChunk) => void) => () => void
  onStreamEnd: (callback: (payload: ChatStreamEnd) => void) => () => void
  onStreamError: (callback: (payload: ChatStreamError) => void) => () => void
}
