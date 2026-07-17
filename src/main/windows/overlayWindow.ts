import { BrowserWindow, screen } from 'electron'
import { join } from 'node:path'
import { is } from '../lib/env'
import { IpcChannels } from '../../preload/shared/ipcChannels'
import type { OverlayConfigurePayload } from '../../preload/shared/types'

const OVERLAY_WIDTH = 420
const OVERLAY_HEIGHT = 560

class OverlayWindowManager {
  private window: BrowserWindow | null = null
  private rendererReady = false
  private pendingPayload: OverlayConfigurePayload | null = null

  // Created once at startup and reused for every assistant — cheaper than a
  // per-assistant window pool, and per-assistant chat state (added in M4)
  // will live in the main process regardless of which window shows it.
  create(): void {
    if (this.window && !this.window.isDestroyed()) return

    this.window = new BrowserWindow({
      width: OVERLAY_WIDTH,
      height: OVERLAY_HEIGHT,
      show: false,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: true,
      hasShadow: false,
      webPreferences: {
        preload: join(__dirname, '../preload/overlay.js'),
        contextIsolation: true,
        // Electron's sandboxed preload loader can't resolve the shared chunk
        // Rollup emits for code (like ipcChannels.ts) imported by both
        // preload entries — contextIsolation + nodeIntegration:false remain
        // the actual security boundary against the renderer here.
        sandbox: false,
        nodeIntegration: false
      }
    })

    this.window.on('blur', () => {
      if (!this.window || this.window.webContents.isDevToolsOpened()) return
      this.window.hide()
    })

    this.window.webContents.on('did-finish-load', () => {
      this.rendererReady = true
      if (this.pendingPayload) this.sendConfigure(this.pendingPayload)
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      this.window.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/overlay/index.html`)
    } else {
      this.window.loadFile(join(__dirname, '../renderer/overlay/index.html'))
    }
  }

  showFor(payload: OverlayConfigurePayload): void {
    if (!this.window || this.window.isDestroyed()) this.create()
    const win = this.window
    if (!win) return

    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
    win.setBounds({
      x: Math.round(display.workArea.x + (display.workArea.width - OVERLAY_WIDTH) / 2),
      y: Math.round(display.workArea.y + (display.workArea.height - OVERLAY_HEIGHT) / 2),
      width: OVERLAY_WIDTH,
      height: OVERLAY_HEIGHT
    })

    this.pendingPayload = payload
    if (this.rendererReady) this.sendConfigure(payload)

    win.show()
    win.focus()
    win.moveTop()
  }

  hide(): void {
    this.window?.hide()
  }

  private sendConfigure(payload: OverlayConfigurePayload): void {
    this.window?.webContents.send(IpcChannels.overlayConfigure, payload)
    this.pendingPayload = null
  }
}

export const overlayWindowManager = new OverlayWindowManager()
