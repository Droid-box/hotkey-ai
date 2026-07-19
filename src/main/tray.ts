import { app, Menu, nativeImage, Tray, type MenuItemConstructorOptions } from 'electron'
import { managementWindowManager } from './windows/managementWindow'
import { TRAY_ICON_DATA_URL } from './lib/trayIcon'

let tray: Tray | null = null
// Set by the updater when a downloaded update is ready to install.
let pendingUpdate: { version: string; onInstall: () => void } | null = null

function buildMenu(): Menu {
  const items: MenuItemConstructorOptions[] = [
    { label: 'Open Hotkey AI', click: () => managementWindowManager.showOrCreate() }
  ]
  if (pendingUpdate) {
    const update = pendingUpdate
    items.push(
      { type: 'separator' },
      { label: `Restart to update (v${update.version})`, click: () => update.onInstall() }
    )
  }
  items.push({ type: 'separator' }, { label: 'Quit', click: () => app.quit() })
  return Menu.buildFromTemplate(items)
}

export function createTray(): void {
  const icon = nativeImage.createFromDataURL(TRAY_ICON_DATA_URL)
  tray = new Tray(icon)
  tray.setToolTip('Hotkey AI')
  tray.setContextMenu(buildMenu())
  tray.on('click', () => managementWindowManager.showOrCreate())
}

// Add/remove the tray's "Restart to update" item as an update becomes ready.
export function setTrayUpdate(update: { version: string; onInstall: () => void } | null): void {
  pendingUpdate = update
  tray?.setContextMenu(buildMenu())
}
