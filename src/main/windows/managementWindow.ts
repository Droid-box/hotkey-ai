import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { is } from '../lib/env'

// Once the app is actually quitting (tray Quit, dev-server watchdog, OS
// shutdown), the hide-to-tray close handler must stand aside — a
// preventDefault() there would otherwise veto app.quit() entirely.
let appIsQuitting = false
app.on('before-quit', () => {
  appIsQuitting = true
})

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
      // Transparent so the rounded .app-shell corners (management.css) show
      // through, matching the chat overlay. Same rationale as overlayWindow.
      transparent: true,
      // Custom title bar (TitleBar.tsx) replaces the OS chrome — the stock
      // decorations clash with the app's dark theme.
      frame: false,
      hasShadow: false,
      // Linux/WSLg: non-resizable keeps the X11 window exactly content-sized
      // (a resizable frameless window carries an invisible grab-margin that
      // WSLg renders as a visible band). Resize/maximize are reimplemented in
      // windowControlsIpc + ResizeHandles. Windows keeps native behavior.
      resizable: process.platform !== 'linux',
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
      if (!this.window || appIsQuitting) return
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
