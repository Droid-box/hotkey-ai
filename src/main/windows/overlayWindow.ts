import { BrowserWindow, screen, shell } from 'electron'
import { join } from 'node:path'
import { is } from '../lib/env'
import { IpcChannels } from '../../preload/shared/ipcChannels'
import type { OverlayConfigurePayload } from '../../preload/shared/types'

const OVERLAY_WIDTH = 420
// The window opens compact (header + input only) and grows with the
// conversation, driven by renderer measurements, up to the max.
const OVERLAY_MIN_HEIGHT = 110
const OVERLAY_MAX_HEIGHT = 560

class OverlayWindowManager {
  private window: BrowserWindow | null = null
  private rendererReady = false
  private pendingPayload: OverlayConfigurePayload | null = null
  private currentAssistantId: string | null = null

  // Created once at startup and reused for every assistant — cheaper than a
  // per-assistant window pool, and per-assistant chat state (added in M4)
  // will live in the main process regardless of which window shows it.
  create(): void {
    if (this.window && !this.window.isDestroyed()) return

    this.window = new BrowserWindow({
      width: OVERLAY_WIDTH,
      height: OVERLAY_MIN_HEIGHT,
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

    // Markdown responses can contain links — open them in the default
    // browser, never inside the overlay.
    this.window.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url)
      return { action: 'deny' }
    })
    this.window.webContents.on('will-navigate', (event, url) => {
      event.preventDefault()
      shell.openExternal(url)
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      this.window.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/overlay/index.html`)
    } else {
      this.window.loadFile(join(__dirname, '../renderer/overlay/index.html'))
    }
  }

  /** True when the overlay is on screen showing this assistant's chat. */
  isShowingAssistant(assistantId: string): boolean {
    return (
      !!this.window &&
      !this.window.isDestroyed() &&
      this.window.isVisible() &&
      this.currentAssistantId === assistantId
    )
  }

  showFor(payload: OverlayConfigurePayload): void {
    if (!this.window || this.window.isDestroyed()) this.create()
    const win = this.window
    if (!win) return

    this.currentAssistantId = payload.assistant?.id ?? null

    // Bottom-center of the monitor the cursor is currently on, a small
    // margin above the taskbar. The input box lives at the bottom of the
    // window and growth happens upward, so parking near the bottom keeps
    // the input in easy reach and leaves maximum headroom for messages.
    const BOTTOM_MARGIN = 24
    const { workArea } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
    win.setBounds({
      x: Math.round(workArea.x + (workArea.width - OVERLAY_WIDTH) / 2),
      y: workArea.y + workArea.height - BOTTOM_MARGIN - OVERLAY_MIN_HEIGHT,
      width: OVERLAY_WIDTH,
      height: OVERLAY_MIN_HEIGHT
    })

    this.pendingPayload = payload
    if (this.rendererReady) this.sendConfigure(payload)

    win.show()
    win.focus()
    win.moveTop()
  }

  // Called by the renderer (via IPC) with its measured content height each
  // time messages/input change. The bottom edge is the anchor: the window
  // grows/shrinks upward so the input box never moves on screen. showFor
  // already placed the bottom edge low enough for max growth, so no
  // workArea clamp here (WSLg reports unreliable display metrics anyway).
  resizeToContent(contentHeight: number): void {
    const win = this.window
    if (!win || win.isDestroyed()) return

    const bounds = win.getBounds()
    const bottomEdge = bounds.y + bounds.height
    const height = Math.round(
      Math.min(Math.max(contentHeight, OVERLAY_MIN_HEIGHT), OVERLAY_MAX_HEIGHT)
    )
    if (height !== bounds.height) {
      win.setBounds({ x: bounds.x, y: bottomEdge - height, width: OVERLAY_WIDTH, height })
    }
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
