import { BrowserWindow, screen, shell } from 'electron'
import { join } from 'node:path'
import { is } from '../lib/env'
import { IpcChannels } from '../../preload/shared/ipcChannels'
import type { ChatWindowSize, OverlayConfigurePayload } from '../../preload/shared/types'
import { getChatWindowOpacity, getChatWindowSize } from '../store/settingsStore'

// Chat window size presets (Settings → Chat Window Size). Width is fixed per
// preset; the window still opens compact and grows with the conversation up
// to the preset's max height. Small = the original size.
const CHAT_WINDOW_DIMENSIONS: Record<ChatWindowSize, { width: number; maxHeight: number }> = {
  small: { width: 420, maxHeight: 560 },
  medium: { width: 520, maxHeight: 680 },
  large: { width: 640, maxHeight: 820 }
}

// The window opens compact (header + input only) and grows with the
// conversation, driven by renderer measurements, up to the preset max.
const OVERLAY_MIN_HEIGHT = 110
const BOTTOM_MARGIN = 24

// Open animation: the whole window slides up from a small offset below its
// resting spot at a constant (linear) speed — a floating panel emerging from
// the bottom. Driven in the main process (setBounds) so it moves as a single
// unit with no height animation, no content reflow, and no opacity change.
const OPEN_SLIDE_PX = 52
const OPEN_ANIM_MS = 180

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
  // Current size preset's dimensions, re-read from settings on each fresh
  // summon so a change in Settings takes effect the next time the chat opens.
  private overlayWidth = CHAT_WINDOW_DIMENSIONS.small.width
  private maxHeight = CHAT_WINDOW_DIMENSIONS.small.maxHeight

  private applyChatWindowSize(): void {
    const dims = CHAT_WINDOW_DIMENSIONS[getChatWindowSize()]
    this.overlayWidth = dims.width
    this.maxHeight = dims.maxHeight
  }

  // Applies the persisted overlay opacity. setOpacity sticks on the reused
  // window even while hidden, so this works both live (settings change) and
  // at startup. No-op on Linux/WSLg, where setOpacity isn't supported.
  applyChatWindowOpacity(): void {
    const win = this.window
    if (!win || win.isDestroyed()) return
    win.setOpacity(getChatWindowOpacity())
  }

  // Created once at startup and reused for every assistant — cheaper than a
  // per-assistant window pool, and per-assistant chat state (added in M4)
  // will live in the main process regardless of which window shows it.
  create(): void {
    if (this.window && !this.window.isDestroyed()) return

    // Start from the persisted preset so the first summon is already sized.
    this.applyChatWindowSize()

    this.window = new BrowserWindow({
      width: this.overlayWidth,
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

    // Restore the saved opacity on this freshly-created window.
    this.applyChatWindowOpacity()
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
      // Fresh summon: pin defaults off so click-away dismisses as usual, and
      // pick up any change to the chat window size preset.
      this.pinned = false
      this.applyChatWindowSize()
      const { workArea } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
      this.overlayX = Math.round(workArea.x + (workArea.width - this.overlayWidth) / 2)
      this.baseBottomEdge = workArea.y + workArea.height - BOTTOM_MARGIN
      this.currentHeight = OVERLAY_MIN_HEIGHT
      this.slideOffset = OPEN_SLIDE_PX
      // Position the window at its start (low) spot before showing, so it
      // never flashes at its final position for a frame.
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
      width: this.overlayWidth,
      height: this.currentHeight
    })
  }

  private startOpenAnimation(): void {
    const win = this.window
    if (!win || win.isDestroyed()) return
    if (this.openAnimTimer) clearInterval(this.openAnimTimer)

    const start = Date.now()
    this.openAnimTimer = setInterval(() => {
      const w = this.window
      if (!w || w.isDestroyed()) {
        if (this.openAnimTimer) clearInterval(this.openAnimTimer)
        this.openAnimTimer = null
        return
      }
      // Linear: slide offset decreases at a constant rate to zero.
      const t = Math.min(1, (Date.now() - start) / OPEN_ANIM_MS)
      this.slideOffset = OPEN_SLIDE_PX * (1 - t)
      this.applyOverlayBounds()
      if (t >= 1) {
        if (this.openAnimTimer) clearInterval(this.openAnimTimer)
        this.openAnimTimer = null
        this.slideOffset = 0
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
      Math.min(Math.max(contentHeight, OVERLAY_MIN_HEIGHT), this.maxHeight)
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
      win.setBounds({ x: bounds.x, y: bottomEdge - target, width: this.overlayWidth, height: target })
    }
  }

  hide(): void {
    this.pinned = false
    if (this.openAnimTimer) {
      clearInterval(this.openAnimTimer)
      this.openAnimTimer = null
    }
    this.slideOffset = 0
    this.window?.hide()
  }

  private sendConfigure(payload: OverlayConfigurePayload): void {
    this.window?.webContents.send(IpcChannels.overlayConfigure, payload)
    this.pendingPayload = null
  }
}

export const overlayWindowManager = new OverlayWindowManager()
