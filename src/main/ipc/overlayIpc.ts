import { ipcMain } from 'electron'
import { z } from 'zod'
import { IpcChannels } from '../../preload/shared/ipcChannels'
import { overlayWindowManager } from '../windows/overlayWindow'

const ResizeContentSchema = z.object({
  height: z.number().min(0).max(4000),
  animate: z.boolean()
})

export function registerOverlayIpc(): void {
  ipcMain.on(IpcChannels.overlayClose, () => overlayWindowManager.hide())

  ipcMain.on(IpcChannels.overlayResizeContent, (_event, rawPayload: unknown) => {
    const { height, animate } = ResizeContentSchema.parse(rawPayload)
    overlayWindowManager.resizeToContent(height, animate)
  })

  ipcMain.on(IpcChannels.overlaySetPinned, (_event, rawPinned: unknown) => {
    overlayWindowManager.setPinned(z.boolean().parse(rawPinned))
  })
}
