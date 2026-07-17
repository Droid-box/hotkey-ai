import { ipcMain } from 'electron'
import { IpcChannels } from '../../preload/shared/ipcChannels'
import { overlayWindowManager } from '../windows/overlayWindow'

export function registerOverlayIpc(): void {
  ipcMain.on(IpcChannels.overlayClose, () => overlayWindowManager.hide())
}
