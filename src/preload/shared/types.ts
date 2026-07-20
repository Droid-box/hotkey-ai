export type ProviderId = 'openai' | 'anthropic'

/** Chat overlay size preset (Settings → Chat Window Size). */
export type ChatWindowSize = 'small' | 'medium' | 'large'

/** App theme (Settings → Theme). 'system' follows the OS preference. */
export type ThemeSetting = 'system' | 'dark' | 'light'

export interface AppSettings {
  chatWindowSize: ChatWindowSize
  /** Overlay window opacity, 0.5–1 (1 = fully opaque). */
  chatWindowOpacity: number
  /** Start Hotkey AI automatically when the user signs in to Windows. */
  launchAtStartup: boolean
  /** Light/dark/system theme applied across every window. */
  theme: ThemeSetting
  /** Download updates automatically in the background (install on restart). */
  autoInstallUpdates: boolean
}

/**
 * Auto-update lifecycle. 'dev' means updates are unavailable (dev run or an
 * unpacked build); the rest mirror electron-updater's events.
 */
export type UpdateStatus =
  | 'dev'
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'not-available'
  | 'error'

export interface UpdateState {
  status: UpdateStatus
  currentVersion: string
  newVersion: string | null
  /** Download progress 0–100 while status is 'downloading'. */
  percent: number
  error: string | null
}

export interface Assistant {
  id: string
  name: string
  systemPrompt: string
  provider: ProviderId
  model: string
  shortcut: string
  /** Clear this assistant's conversation when its overlay is closed, so it
   *  starts a fresh chat next time instead of restoring history. */
  resetChatOnClose: boolean
  /** Pre-fill the overlay input with the clipboard contents when summoned. */
  prefillClipboard: boolean
  createdAt: string
  updatedAt: string
}

export type AssistantInput = Omit<Assistant, 'id' | 'createdAt' | 'updatedAt'>

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/** A saved conversation thread (metadata only; messages live in its file). */
export interface ConversationMeta {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

/** The sidebar payload for one assistant: its threads + which one is active. */
export interface ConversationList {
  activeId: string | null
  conversations: ConversationMeta[]
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
  /** Ephemeral test chat for the assistant editor — uses the assistant's saved
   *  config, never touches its real (persisted) conversation. */
  testChat: {
    send: (assistantId: string, messages: ChatMessage[]) => void
    abort: (assistantId: string) => void
    onStreamChunk: (callback: (payload: ChatStreamChunk) => void) => () => void
    onStreamEnd: (callback: (payload: ChatStreamEnd) => void) => () => void
    onStreamError: (callback: (payload: ChatStreamError) => void) => () => void
  }
  /** Copy text to the clipboard (message/code copy buttons). */
  copyText: (text: string) => void
  settings: {
    get: () => Promise<AppSettings>
    setChatWindowSize: (size: ChatWindowSize) => Promise<void>
    setChatWindowOpacity: (opacity: number) => Promise<void>
    setLaunchAtStartup: (enabled: boolean) => Promise<void>
    setTheme: (theme: ThemeSetting) => Promise<void>
    setAutoInstallUpdates: (enabled: boolean) => Promise<void>
  }
  updates: {
    getState: () => Promise<UpdateState>
    /** Manually check now (also downloads if auto-install is on / when available). */
    check: () => void
    /** Download an available update when auto-install is off. */
    download: () => void
    /** Quit and install a downloaded update. */
    install: () => void
    onStateChanged: (callback: (state: UpdateState) => void) => () => void
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
  /** Text to pre-fill the input with (clipboard contents), if enabled. */
  prefill?: string
  /** This assistant's saved threads (for the history sidebar), newest first. */
  conversations: ConversationMeta[]
  /** The thread currently shown (null when it's a fresh, empty one). */
  activeConversationId: string | null
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
  /** Toggle the history sidebar — main widens/resizes the window accordingly. */
  setHistoryOpen: (open: boolean) => void
  /** Conversation history (threads) for the history sidebar. */
  conversations: {
    list: (assistantId: string) => Promise<ConversationList>
    /** Make a past thread active; resolves to its messages. */
    open: (assistantId: string, conversationId: string) => Promise<ChatMessage[]>
    /** Delete a thread; resolves to the updated list. */
    delete: (assistantId: string, conversationId: string) => Promise<ConversationList>
    /** Delete several threads at once (bulk select); resolves to the updated list. */
    deleteMany: (assistantId: string, conversationIds: string[]) => Promise<ConversationList>
    /** Pushed when the active thread gains messages / reorders / is titled. */
    onChanged: (
      callback: (payload: { assistantId: string; list: ConversationList }) => void
    ) => () => void
  }
  onStreamChunk: (callback: (payload: ChatStreamChunk) => void) => () => void
  onStreamEnd: (callback: (payload: ChatStreamEnd) => void) => () => void
  onStreamError: (callback: (payload: ChatStreamError) => void) => () => void
}
