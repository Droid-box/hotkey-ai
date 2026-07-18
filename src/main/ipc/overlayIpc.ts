import { ipcMain } from 'electron'
import { z } from 'zod'
import { IpcChannels } from '../../preload/shared/ipcChannels'
import { overlayWindowManager } from '../windows/overlayWindow'

const ContentHeightSchema = z.number().min(0).max(4000)

export function registerOverlayIpc(): void {
  ipcMain.on(IpcChannels.overlayClose, () => overlayWindowManager.hide())

  ipcMain.on(IpcChannels.overlayResizeContent, (_event, rawHeight: unknown) => {
    overlayWindowManager.resizeToContent(ContentHeightSchema.parse(rawHeight))
  })

  ipcMain.on(IpcChannels.overlaySetPinned, (_event, rawPinned: unknown) => {
    overlayWindowManager.setPinned(z.boolean().parse(rawPinned))
  })
}
