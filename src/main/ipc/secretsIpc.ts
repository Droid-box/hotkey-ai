import { ipcMain } from 'electron'
import { z } from 'zod'
import { IpcChannels } from '../../preload/shared/ipcChannels'
import type { ApiKeyStatus } from '../../preload/shared/types'
import { ProviderIdSchema } from '../store/schema'
import { secretsStore } from '../store/secretsStore'

const ApiKeySchema = z.string().min(1).max(500)

export function registerSecretsIpc(): void {
  ipcMain.handle(IpcChannels.secretsSetApiKey, (_event, rawProvider: unknown, rawKey: unknown): ApiKeyStatus => {
    const provider = ProviderIdSchema.parse(rawProvider)
    const key = ApiKeySchema.parse(rawKey)
    return secretsStore.setApiKey(provider, key.trim())
  })

  ipcMain.handle(IpcChannels.secretsGetApiKeyStatus, (_event, rawProvider: unknown): ApiKeyStatus => {
    const provider = ProviderIdSchema.parse(rawProvider)
    return secretsStore.getApiKeyStatus(provider)
  })

  ipcMain.handle(IpcChannels.secretsDeleteApiKey, (_event, rawProvider: unknown): void => {
    const provider = ProviderIdSchema.parse(rawProvider)
    secretsStore.deleteApiKey(provider)
  })
}
