import { ipcMain } from 'electron'
import { IpcChannels } from '../../preload/shared/ipcChannels'
import type { AppSettings } from '../../preload/shared/types'
import { ChatWindowSizeSchema } from '../store/schema'
import { loadSettings, setChatWindowSize } from '../store/settingsStore'

export function registerSettingsIpc(): void {
  ipcMain.handle(IpcChannels.settingsGet, (): AppSettings => loadSettings())

  ipcMain.handle(IpcChannels.settingsSetChatWindowSize, (_event, rawSize: unknown): void => {
    // The overlay reads the persisted size each time it opens, so no live
    // notification is needed — the change takes effect on the next summon.
    setChatWindowSize(ChatWindowSizeSchema.parse(rawSize))
  })
}
