export const IpcChannels = {
  assistantList: 'assistant:list',
  assistantCreate: 'assistant:create',
  assistantUpdate: 'assistant:update',
  assistantDelete: 'assistant:delete',
  assistantUpdated: 'assistant:updated',

  shortcutCheckConflict: 'shortcut:check-conflict',
  shortcutGetFailures: 'shortcut:get-failures',
  shortcutFailuresChanged: 'shortcut:failures-changed',

  modelsList: 'models:list',

  settingsGet: 'settings:get',
  settingsSetChatWindowSize: 'settings:set-chat-window-size',
  settingsSetChatWindowOpacity: 'settings:set-chat-window-opacity',
  settingsSetLaunchAtStartup: 'settings:set-launch-at-startup',
  settingsSetTheme: 'settings:set-theme',
  settingsSetAutoInstallUpdates: 'settings:set-auto-install-updates',

  updatesGetState: 'updates:get-state',
  updatesCheck: 'updates:check',
  updatesDownload: 'updates:download',
  updatesInstall: 'updates:install',
  updatesStateChanged: 'updates:state-changed',

  windowMinimize: 'window:minimize',
  windowToggleMaximize: 'window:toggle-maximize',
  windowClose: 'window:close',
  windowResize: 'window:resize',
  windowMaximizedChanged: 'window:maximized-changed',

  secretsSetApiKey: 'secrets:set-api-key',
  secretsGetApiKeyStatus: 'secrets:get-api-key-status',
  secretsDeleteApiKey: 'secrets:delete-api-key',
  secretsTestApiKey: 'secrets:test-api-key',
  secretsListApiKeys: 'secrets:list-api-keys',

  overlayConfigure: 'overlay:configure',
  overlayClose: 'overlay:close',
  overlayResizeContent: 'overlay:resize-content',
  overlaySetPinned: 'overlay:set-pinned',
  overlayOpenApiKeys: 'overlay:open-api-keys',
  overlaySetHistoryOpen: 'overlay:set-history-open',

  conversationsList: 'conversations:list',
  conversationsOpen: 'conversations:open',
  conversationsDelete: 'conversations:delete',
  conversationsDeleteMany: 'conversations:delete-many',
  conversationsChanged: 'conversations:changed',

  managementNavigate: 'management:navigate',

  chatSend: 'chat:send',
  chatAbort: 'chat:abort',
  chatReset: 'chat:reset',
  chatStreamChunk: 'chat:stream-chunk',
  chatStreamEnd: 'chat:stream-end',
  chatStreamError: 'chat:stream-error',

  // Assistant-editor test chat: same provider streaming, but an ephemeral
  // conversation (owned by the renderer) that never touches saved history.
  testChatSend: 'test-chat:send',
  testChatAbort: 'test-chat:abort',
  testChatStreamChunk: 'test-chat:stream-chunk',
  testChatStreamEnd: 'test-chat:stream-end',
  testChatStreamError: 'test-chat:stream-error'
} as const
