import { ipcMain } from 'electron'
import { IpcChannels } from '../../preload/shared/ipcChannels'
import type { ModelListResult } from '../../preload/shared/types'
import { ProviderIdSchema } from '../store/schema'
import { listModels } from '../models/modelsCache'

export function registerModelsIpc(): void {
  ipcMain.handle(
    IpcChannels.modelsList,
    async (_event, rawProvider: unknown): Promise<ModelListResult> => {
      const provider = ProviderIdSchema.parse(rawProvider)
      return listModels(provider)
    }
  )
}
