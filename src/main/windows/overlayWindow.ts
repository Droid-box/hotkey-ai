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
const BOTTOM_MARGIN = 24

// Open animation: the whole window slides up from a small offset below its
// resting spot and fades from near-full to full opacity — a floating panel
// emerging from the bottom. Driven in the main process (setBounds + opacity)
// so it moves as a single unit with no height animation and no content
// reflow. setOpacity is a no-op on Linux/WSLg; the slide still plays.
const OPEN_SLIDE_PX = 52
const OPEN_ANIM_MS = 180
const OPEN_START_OPACITY = 0.92

class OverlayWindowManager {
  private window: BrowserWindow | null = null
  private rendererReady = false
  private pendingPayload: OverlayConfigurePayload | null = null
  private currentAssistantId: string | null = null
  private pinned = false
  // Bounds are composed from a fixed bottom edge, the content height, and a
  // transient open-animation slide offset, so the open slide and content
  // resize can run together without fighting over the window's y/height.
  private overlayX = 0
  private baseBottomEdge = 0
  private currentHeight = OVERLAY_MIN_HEIGHT
  private slideOffset = 0
  private openAnimTimer: ReturnType<typeof setInterval> | null = null

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
      // A pinned overlay stays open when it loses focus (click-away).
      if (this.pinned) return
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

  // Caller supplies everything but `pinned`/`justOpened`, which are owned
  // here (reset/derived on a fresh summon).
  showFor(payload: Omit<OverlayConfigurePayload, 'pinned' | 'justOpened'>): void {
    if (!this.window || this.window.isDestroyed()) this.create()
    const win = this.window
    if (!win) return

    this.currentAssistantId = payload.assistant?.id ?? null

    // "Fresh" = the window was hidden. Only then do we (re)place it at the
    // bottom-center of the cursor's monitor and play the slide-up open
    // animation; a re-summon while already visible (new chat / assistant
    // switch) keeps its current position and doesn't animate.
    const fresh = !win.isVisible()
    if (fresh) {
      // Fresh summon: pin defaults off so click-away dismisses as usual.
      this.pinned = false
      const { workArea } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
      this.overlayX = Math.round(workArea.x + (workArea.width - OVERLAY_WIDTH) / 2)
      this.baseBottomEdge = workArea.y + workArea.height - BOTTOM_MARGIN
      this.currentHeight = OVERLAY_MIN_HEIGHT
      this.slideOffset = OPEN_SLIDE_PX
      // Set the start opacity and low position before showing, so the window
      // never flashes at its final spot for a frame.
      win.setOpacity(OPEN_START_OPACITY)
      this.applyOverlayBounds()
    }

    const resolved: OverlayConfigurePayload = { ...payload, pinned: this.pinned, justOpened: fresh }
    this.pendingPayload = resolved
    if (this.rendererReady) this.sendConfigure(resolved)

    win.show()
    win.focus()
    win.moveTop()

    if (fresh) this.startOpenAnimation()
  }

  setPinned(pinned: boolean): void {
    this.pinned = pinned
  }

  // Composes the window bounds from the fixed bottom edge, content height, and
  // the transient open-animation slide offset.
  private applyOverlayBounds(): void {
    const win = this.window
    if (!win || win.isDestroyed()) return
    win.setBounds({
      x: this.overlayX,
      y: Math.round(this.baseBottomEdge - this.currentHeight + this.slideOffset),
      width: OVERLAY_WIDTH,
      height: this.currentHeight
    })
  }

  private startOpenAnimation(): void {
    const win = this.window
    if (!win || win.isDestroyed()) return
    if (this.openAnimTimer) clearInterval(this.openAnimTimer)

    const start = Date.now()
    const easeOut = (t: number): number => 1 - Math.pow(1 - t, 3)
    this.openAnimTimer = setInterval(() => {
      const w = this.window
      if (!w || w.isDestroyed()) {
        if (this.openAnimTimer) clearInterval(this.openAnimTimer)
        this.openAnimTimer = null
        return
      }
      const t = Math.min(1, (Date.now() - start) / OPEN_ANIM_MS)
      const e = easeOut(t)
      this.slideOffset = OPEN_SLIDE_PX * (1 - e)
      w.setOpacity(OPEN_START_OPACITY + (1 - OPEN_START_OPACITY) * e)
      this.applyOverlayBounds()
      if (t >= 1) {
        if (this.openAnimTimer) clearInterval(this.openAnimTimer)
        this.openAnimTimer = null
        this.slideOffset = 0
        w.setOpacity(1)
        this.applyOverlayBounds()
      }
    }, 16)
  }

  // Called by the renderer (via IPC) with its measured content height each
  // time messages/input change. The bottom edge is the anchor: the window
  // grows/shrinks upward so the input box never moves on screen.
  resizeToContent(contentHeight: number): void {
    const win = this.window
    if (!win || win.isDestroyed()) return

    const target = Math.round(
      Math.min(Math.max(contentHeight, OVERLAY_MIN_HEIGHT), OVERLAY_MAX_HEIGHT)
    )

    // While the open animation runs, keep the shared height in sync and let
    // applyOverlayBounds compose it with the slide offset.
    if (this.openAnimTimer) {
      this.currentHeight = target
      this.applyOverlayBounds()
      return
    }

    // Otherwise anchor to the window's current bottom edge (respects a manual
    // drag). Keep the base state in sync for the next open animation.
    const bounds = win.getBounds()
    const bottomEdge = bounds.y + bounds.height
    this.overlayX = bounds.x
    this.baseBottomEdge = bottomEdge
    this.currentHeight = target
    if (target !== bounds.height) {
      win.setBounds({ x: bounds.x, y: bottomEdge - target, width: OVERLAY_WIDTH, height: target })
    }
  }

  hide(): void {
    this.pinned = false
    if (this.openAnimTimer) {
      clearInterval(this.openAnimTimer)
      this.openAnimTimer = null
    }
    this.slideOffset = 0
    // Reset opacity so a hide mid-animation doesn't leave the next open dim.
    this.window?.setOpacity(1)
    this.window?.hide()
  }

  private sendConfigure(payload: OverlayConfigurePayload): void {
    this.window?.webContents.send(IpcChannels.overlayConfigure, payload)
    this.pendingPayload = null
  }
}

export const overlayWindowManager = new OverlayWindowManager()
