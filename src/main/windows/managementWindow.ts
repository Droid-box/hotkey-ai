import { BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { is } from '../lib/env'

class ManagementWindowManager {
  private window: BrowserWindow | null = null

  showOrCreate(): void {
    if (this.window && !this.window.isDestroyed()) {
      if (this.window.isMinimized()) this.window.restore()
      this.window.show()
      this.window.focus()
      return
    }

    this.window = new BrowserWindow({
      width: 960,
      height: 640,
      show: false,
      title: 'Hotkey AI',
      webPreferences: {
        preload: join(__dirname, '../preload/management.js'),
        contextIsolation: true,
        // See overlayWindow.ts: sandboxed preload can't resolve the shared
        // chunk both preload entries now pull ipcChannels.ts from.
        sandbox: false,
        nodeIntegration: false
      }
    })

    this.window.on('ready-to-show', () => this.window?.show())

    // Keep the app tray-resident: closing the window hides it instead of
    // destroying it, since Quit (from the tray) is the only real exit path.
    this.window.on('close', (event) => {
      if (!this.window) return
      event.preventDefault()
      this.window.hide()
    })

    this.window.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url)
      return { action: 'deny' }
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      this.window.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/management/index.html`)
    } else {
      this.window.loadFile(join(__dirname, '../renderer/management/index.html'))
    }
  }
}

export const managementWindowManager = new ManagementWindowManager()
