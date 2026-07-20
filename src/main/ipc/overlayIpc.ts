import { ipcMain } from 'electron'
import { z } from 'zod'
import { IpcChannels } from '../../preload/shared/ipcChannels'
import { overlayWindowManager } from '../windows/overlayWindow'
import { managementWindowManager } from '../windows/managementWindow'

const ContentHeightSchema = z.number().min(0).max(4000)

export function registerOverlayIpc(): void {
  ipcMain.on(IpcChannels.overlayClose, () => overlayWindowManager.hide())

  ipcMain.on(IpcChannels.overlayResizeContent, (_event, rawHeight: unknown) => {
    overlayWindowManager.resizeToContent(ContentHeightSchema.parse(rawHeight))
  })

  ipcMain.on(IpcChannels.overlaySetPinned, (_event, rawPinned: unknown) => {
    overlayWindowManager.setPinned(z.boolean().parse(rawPinned))
  })

  ipcMain.on(IpcChannels.overlaySetHistoryOpen, (_event, rawOpen: unknown) => {
    overlayWindowManager.setHistoryOpen(z.boolean().parse(rawOpen))
  })

  // From a "no API key" error in the overlay: hide the (always-on-top) overlay
  // so it doesn't cover the window, then open the management UI on the keys tab.
  ipcMain.on(IpcChannels.overlayOpenApiKeys, () => {
    overlayWindowManager.hide()
    managementWindowManager.showOrCreate()
    managementWindowManager.navigateTo('keys')
  })
}
