export const IpcChannels = {
  assistantList: 'assistant:list',
  assistantCreate: 'assistant:create',
  assistantUpdate: 'assistant:update',
  assistantDelete: 'assistant:delete',
  assistantUpdated: 'assistant:updated',

  shortcutCheckConflict: 'shortcut:check-conflict',

  secretsSetApiKey: 'secrets:set-api-key',
  secretsGetApiKeyStatus: 'secrets:get-api-key-status',
  secretsDeleteApiKey: 'secrets:delete-api-key',

  overlayConfigure: 'overlay:configure',
  overlayClose: 'overlay:close',

  chatSend: 'chat:send',
  chatAbort: 'chat:abort',
  chatStreamChunk: 'chat:stream-chunk',
  chatStreamEnd: 'chat:stream-end',
  chatStreamError: 'chat:stream-error'
} as const
