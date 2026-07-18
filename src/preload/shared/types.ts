export type ProviderId = 'openai' | 'anthropic'

/** Chat overlay size preset (Settings → Chat Window Size). */
export type ChatWindowSize = 'small' | 'medium' | 'large'

export interface AppSettings {
  chatWindowSize: ChatWindowSize
  /** Overlay window opacity, 0.5–1 (1 = fully opaque). */
  chatWindowOpacity: number
  /** Start Hotkey AI automatically when the user signs in to Windows. */
  launchAtStartup: boolean
}

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

export interface ShortcutCheckResult {
  ok: boolean
  reason: string | null
}

export interface ManagementBridge {
  appName: string
  /** Node's process.platform — lets the UI hide controls that misbehave under WSLg. */
  platform: string
  /** Main asks the UI to switch tabs (e.g. 'keys' from a missing-key error). */
  onNavigate: (callback: (tab: string) => void) => () => void
  shortcuts: {
    checkConflict: (accelerator: string, excludeId?: string) => Promise<ShortcutCheckResult>
    /** Assistant ids whose global shortcut the OS refused to register. */
    getFailures: () => Promise<string[]>
    onFailuresChanged: (callback: (assistantIds: string[]) => void) => () => void
  }
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
  settings: {
    get: () => Promise<AppSettings>
    setChatWindowSize: (size: ChatWindowSize) => Promise<void>
    setChatWindowOpacity: (opacity: number) => Promise<void>
    setLaunchAtStartup: (enabled: boolean) => Promise<void>
  }
  windowControls: {
    minimize: () => void
    toggleMaximize: () => void
    close: () => void
    /** Start/stop an edge drag; the main process tracks the cursor itself. */
    resize: (edge: ResizeEdge, phase: ResizePhase) => void
    onMaximizedChanged: (callback: (maximized: boolean) => void) => () => void
  }
}

export type ResizeEdge =
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
export type ResizePhase = 'start' | 'end'

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
  /** Whether the overlay is currently pinned (won't auto-hide on blur). */
  pinned: boolean
  /** True when this is a fresh open (was hidden) — triggers the slide-up. */
  justOpened: boolean
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
  /** Suggested user action for this error. 'add-api-key' => no key configured
   *  (retrying won't help); undefined => a transient error worth retrying. */
  action?: 'add-api-key'
}

export interface OverlayBridge {
  onConfigure: (callback: (payload: OverlayConfigurePayload) => void) => () => void
  close: () => void
  /** Ask the main process to fit the overlay window height to rendered content. */
  resizeContent: (contentHeight: number) => void
  sendMessage: (assistantId: string, message: string) => void
  abort: (assistantId: string) => void
  resetChat: (assistantId: string) => void
  copyText: (text: string) => void
  /** Pin/unpin: a pinned overlay stays open when it loses focus. */
  setPinned: (pinned: boolean) => void
  /** Open the management window on the API keys tab (from a missing-key error). */
  openApiKeys: () => void
  onStreamChunk: (callback: (payload: ChatStreamChunk) => void) => () => void
  onStreamEnd: (callback: (payload: ChatStreamEnd) => void) => () => void
  onStreamError: (callback: (payload: ChatStreamError) => void) => () => void
}
