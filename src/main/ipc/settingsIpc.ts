import { ipcMain } from 'electron'
import { z } from 'zod'
import { IpcChannels } from '../../preload/shared/ipcChannels'
import type { AppSettings } from '../../preload/shared/types'
import { ChatWindowOpacitySchema, ChatWindowSizeSchema } from '../store/schema'
import {
  loadSettings,
  setChatWindowOpacity,
  setChatWindowSize,
  setLaunchAtStartup
} from '../store/settingsStore'
import { overlayWindowManager } from '../windows/overlayWindow'
import { applyLaunchAtStartup } from '../lib/loginItem'

export function registerSettingsIpc(): void {
  ipcMain.handle(IpcChannels.settingsGet, (): AppSettings => loadSettings())

  ipcMain.handle(IpcChannels.settingsSetChatWindowSize, (_event, rawSize: unknown): void => {
    // The overlay reads the persisted size each time it opens, so no live
    // notification is needed — the change takes effect on the next summon.
    setChatWindowSize(ChatWindowSizeSchema.parse(rawSize))
  })

  ipcMain.handle(IpcChannels.settingsSetChatWindowOpacity, (_event, rawOpacity: unknown): void => {
    const opacity = ChatWindowOpacitySchema.parse(rawOpacity)
    setChatWindowOpacity(opacity)
    // Apply immediately: setOpacity persists on the (reused) overlay window
    // even while it's hidden, so this both updates a visible overlay live and
    // carries the new value into the next summon.
    overlayWindowManager.applyChatWindowOpacity()
  })

  ipcMain.handle(IpcChannels.settingsSetLaunchAtStartup, (_event, rawEnabled: unknown): void => {
    const enabled = z.boolean().parse(rawEnabled)
    setLaunchAtStartup(enabled)
    applyLaunchAtStartup(enabled)
  })
}
