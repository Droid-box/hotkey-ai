import { ipcMain } from 'electron'
import { z } from 'zod'
import { IpcChannels } from '../../preload/shared/ipcChannels'
import type { AppSettings } from '../../preload/shared/types'
import { ChatWindowOpacitySchema, ChatWindowSizeSchema, ThemeSchema } from '../store/schema'
import {
  loadSettings,
  setAutoInstallUpdates,
  setChatWindowOpacity,
  setChatWindowSize,
  setLaunchAtStartup,
  setTextZoom,
  setTheme
} from '../store/settingsStore'
import { overlayWindowManager } from '../windows/overlayWindow'
import { managementWindowManager } from '../windows/managementWindow'
import { applyLaunchAtStartup } from '../lib/loginItem'
import { applyThemeSource } from '../lib/theme'
import { setUpdateAutoDownload } from '../updater'

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

  ipcMain.handle(IpcChannels.settingsSetTheme, (_event, rawTheme: unknown): void => {
    const theme = ThemeSchema.parse(rawTheme)
    setTheme(theme)
    // Drives prefers-color-scheme in every renderer (CSS re-themes live) and
    // refreshes the management window's native background.
    applyThemeSource(theme)
    managementWindowManager.refreshThemeBackground()
  })

  ipcMain.handle(IpcChannels.settingsSetAutoInstallUpdates, (_event, rawEnabled: unknown): void => {
    const enabled = z.boolean().parse(rawEnabled)
    setAutoInstallUpdates(enabled)
    setUpdateAutoDownload(enabled)
  })

  // Fire-and-forget: a renderer changed the text zoom (Ctrl +/-/0). Persist it
  // (clamped, never throwing) so every window and the next launch match. Each
  // renderer applies webFrame zoom itself and reads this value on open.
  ipcMain.on(IpcChannels.appSetZoom, (_event, raw: unknown): void => {
    const parsed = z.number().finite().safeParse(raw)
    if (!parsed.success) return
    setTextZoom(Math.min(2.5, Math.max(0.8, parsed.data)))
  })
}
