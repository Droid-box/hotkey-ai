import { app, BrowserWindow, screen, shell } from 'electron'
import { join } from 'node:path'
import { is } from '../lib/env'
import { IpcChannels } from '../../preload/shared/ipcChannels'
import { loadManagementWindowState, saveManagementWindowState } from '../store/windowStateStore'
import { getNormalBounds, rememberNormalBounds } from './normalBounds'
import { windowBackground } from '../lib/theme'

// Persist window position/size across restarts (debounced). getNormalBounds
// returns the restored (non-maximized) bounds even while maximized, so the
// window comes back to its real windowed size next launch.
let saveTimer: ReturnType<typeof setTimeout> | null = null
function persistWindowState(win: BrowserWindow): void {
  if (win.isDestroyed()) return
  const b = getNormalBounds(win) ?? win.getBounds()
  saveManagementWindowState({
    x: b.x,
    y: b.y,
    width: b.width,
    height: b.height,
    isMaximized: win.isMaximized()
  })
}
function scheduleWindowStateSave(win: BrowserWindow): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => persistWindowState(win), 400)
}

// Windows can un-maximize through several paths that never reach our IPC
// handler — the native title-bar double-click and OS shortcuts (Win+Down)
// among them. Restoring the tracked windowed bounds in the 'unmaximize' event
// (below) makes every path land on the same size/position as the maximize
// button. The drag-to-unmaximize path positions the window under the cursor
// itself, so it opts out via this set to avoid being overridden.
const skipUnmaximizeRestore = new WeakSet<BrowserWindow>()

// Restore a maximized window to its previous windowed size, repositioned so
// the cursor sits at the same horizontal ratio along the title bar (and near
// the top), so the in-progress native drag continues to follow the cursor.
function restoreUnderCursor(win: BrowserWindow): void {
  const maxBounds = win.getBounds()
  const cursor = screen.getCursorScreenPoint()
  const ratioX = maxBounds.width > 0 ? (cursor.x - maxBounds.x) / maxBounds.width : 0.5

  skipUnmaximizeRestore.add(win)
  win.unmaximize()
  // Previous windowed size (tracked ourselves; falls back to the OS restore).
  const size = getNormalBounds(win) ?? win.getBounds()
  win.setBounds({
    x: Math.round(cursor.x - ratioX * size.width),
    y: maxBounds.y,
    width: size.width,
    height: size.height
  })
}

// Minimum window size, shared by the native resize (BrowserWindow minWidth/
// minHeight) and the custom WSLg resize handles (windowControlsIpc) so both
// enforce the same floor and the UI never becomes cramped.
export const MANAGEMENT_MIN_WIDTH = 640
export const MANAGEMENT_MIN_HEIGHT = 480

// Once the app is actually quitting (tray Quit, dev-server watchdog, OS
// shutdown), the hide-to-tray close handler must stand aside — a
// preventDefault() there would otherwise veto app.quit() entirely.
let appIsQuitting = false
app.on('before-quit', () => {
  appIsQuitting = true
})

class ManagementWindowManager {
  private window: BrowserWindow | null = null
  private pendingNavigate: string | null = null

  // Re-apply the themed native background after a theme change (or OS theme
  // change while on 'system'), so the window chrome matches the new theme.
  refreshThemeBackground(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.setBackgroundColor(windowBackground())
    }
  }

  // Switch the management UI to a tab (e.g. 'keys'). If the window is still
  // loading (or being created), the target is queued and flushed once its
  // renderer has loaded, so the message is never sent before a listener exists.
  navigateTo(tab: string): void {
    this.pendingNavigate = tab
    this.flushNavigate()
  }

  private flushNavigate(): void {
    const win = this.window
    if (!win || win.isDestroyed() || this.pendingNavigate === null) return
    if (win.webContents.isLoading()) return
    win.webContents.send(IpcChannels.managementNavigate, this.pendingNavigate)
    this.pendingNavigate = null
  }

  showOrCreate(): void {
    if (this.window && !this.window.isDestroyed()) {
      if (this.window.isMinimized()) this.window.restore()
      this.window.show()
      this.window.focus()
      return
    }

    const state = loadManagementWindowState()
    this.window = new BrowserWindow({
      width: state.width,
      height: state.height,
      x: state.x,
      y: state.y,
      minWidth: MANAGEMENT_MIN_WIDTH,
      minHeight: MANAGEMENT_MIN_HEIGHT,
      show: false,
      title: 'Hotkey AI',
      // Opaque (not transparent): transparent frameless windows on Windows
      // lose native title-bar behaviors like double-click-to-maximize. On
      // Windows 11 the OS (DWM) rounds an opaque frameless window's corners
      // natively, so we don't need CSS transparency for that. The color tracks
      // the active theme so there's no wrong-shade flash on load/resize.
      backgroundColor: windowBackground(),
      // Custom title bar (TitleBar.tsx) replaces the OS chrome — the stock
      // decorations clash with the app's dark theme.
      frame: false,
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

    // Capture the initial (windowed) bounds before any maximize below.
    rememberNormalBounds(this.window)

    // Restore a maximized window (native platforms only; Linux uses manual
    // maximize which stays windowed on launch).
    if (state.isMaximized && process.platform !== 'linux') this.window.maximize()

    // Native maximize/unmaximize (Windows, OS shortcuts) → tell the renderer
    // so it can square the window corners while maximized. The Linux manual
    // maximize path emits this itself from windowControlsIpc.
    const win = this.window

    // Track the last windowed bounds + persist (debounced) on move/resize.
    win.on('resize', () => {
      rememberNormalBounds(win)
      scheduleWindowStateSave(win)
    })
    win.on('move', () => {
      rememberNormalBounds(win)
      scheduleWindowStateSave(win)
    })
    win.on('maximize', () => {
      // A frameless window keeps Chromium's own resize-border hit-testing
      // active even when maximized (unlike a framed window, where the OS
      // disables it). Toggle resizable so a maximized window can't be edge-
      // resized and shows no resize cursors. Linux uses manual maximize
      // (these events don't fire there) and must stay non-resizable.
      if (process.platform !== 'linux') win.setResizable(false)
      win.webContents.send(IpcChannels.windowMaximizedChanged, true)
    })
    win.on('unmaximize', () => {
      // Return to the previous windowed size/position for every un-maximize
      // path (restore button, native title-bar double-click, OS shortcut) so
      // they all match the maximize button. The drag path opts out (it has
      // already positioned the window under the cursor). Read the target
      // before setResizable, which can emit a 'resize' that re-records the
      // (wrong, still-maximized) bounds into the normal-bounds map.
      const skip = skipUnmaximizeRestore.delete(win)
      const normal = skip ? undefined : getNormalBounds(win)
      if (process.platform !== 'linux') win.setResizable(true)
      if (normal) win.setBounds(normal)
      win.webContents.send(IpcChannels.windowMaximizedChanged, false)
    })

    // Drag-to-unmaximize (Windows): dragging the title bar of a maximized
    // window restores it under the cursor and lets the native drag continue,
    // like standard Windows apps. `will-move` fires on the real OS move so
    // this composes with FancyZones etc. (`will-move` is Windows/macOS only;
    // the Linux manual-maximize path doesn't use it.)
    win.on('will-move', (event) => {
      if (!win.isMaximized()) return
      event.preventDefault()
      restoreUnderCursor(win)
    })

    // Keep the app tray-resident: closing the window hides it instead of
    // destroying it, since Quit (from the tray) is the only real exit path.
    this.window.on('close', (event) => {
      if (!this.window) return
      // Persist the final position/size on both close-to-tray and real quit.
      persistWindowState(this.window)
      if (appIsQuitting) return
      event.preventDefault()
      this.window.hide()
    })

    this.window.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url)
      return { action: 'deny' }
    })

    // Deliver any navigation queued before the renderer finished loading.
    this.window.webContents.on('did-finish-load', () => this.flushNavigate())

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      this.window.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/management/index.html`)
    } else {
      this.window.loadFile(join(__dirname, '../renderer/management/index.html'))
    }
  }
}

export const managementWindowManager = new ManagementWindowManager()
