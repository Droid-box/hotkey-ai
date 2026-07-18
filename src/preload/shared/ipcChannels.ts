export const IpcChannels = {
  assistantList: 'assistant:list',
  assistantCreate: 'assistant:create',
  assistantUpdate: 'assistant:update',
  assistantDelete: 'assistant:delete',
  assistantUpdated: 'assistant:updated',

  shortcutCheckConflict: 'shortcut:check-conflict',

  modelsList: 'models:list',

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

  chatSend: 'chat:send',
  chatAbort: 'chat:abort',
  chatReset: 'chat:reset',
  chatStreamChunk: 'chat:stream-chunk',
  chatStreamEnd: 'chat:stream-end',
  chatStreamError: 'chat:stream-error'
} as const
