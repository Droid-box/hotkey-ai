import { app, Menu, nativeImage, Tray } from 'electron'
import { join } from 'node:path'
import { managementWindowManager } from './windows/managementWindow'

let tray: Tray | null = null

// A resident 1x1 fallback so the tray never fails to construct even if the
// icon asset is missing during early scaffolding; replace build/icon.ico
// with a real icon before packaging.
const FALLBACK_ICON = nativeImage.createEmpty()

export function createTray(): void {
  const iconPath = join(__dirname, '../../build/icon.ico')
  const icon = nativeImage.createFromPath(iconPath)
  tray = new Tray(icon.isEmpty() ? FALLBACK_ICON : icon)
  tray.setToolTip('Hotkey AI')

  const menu = Menu.buildFromTemplate([
    { label: 'Open Hotkey AI', click: () => managementWindowManager.showOrCreate() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ])
  tray.setContextMenu(menu)
  tray.on('click', () => managementWindowManager.showOrCreate())
}
