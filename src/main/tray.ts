import { app, Menu, nativeImage, Tray } from 'electron'
import { managementWindowManager } from './windows/managementWindow'
import { TRAY_ICON_DATA_URL } from './lib/trayIcon'

let tray: Tray | null = null

export function createTray(): void {
  const icon = nativeImage.createFromDataURL(TRAY_ICON_DATA_URL)
  tray = new Tray(icon)
  tray.setToolTip('Hotkey AI')

  const menu = Menu.buildFromTemplate([
    { label: 'Open Hotkey AI', click: () => managementWindowManager.showOrCreate() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ])
  tray.setContextMenu(menu)
  tray.on('click', () => managementWindowManager.showOrCreate())
}
