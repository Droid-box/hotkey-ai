import { BrowserWindow, ipcMain, screen, type Rectangle } from 'electron'
import { z } from 'zod'
import { IpcChannels } from '../../preload/shared/ipcChannels'
import { MANAGEMENT_MIN_WIDTH, MANAGEMENT_MIN_HEIGHT } from '../windows/managementWindow'

const MIN_WIDTH = MANAGEMENT_MIN_WIDTH
const MIN_HEIGHT = MANAGEMENT_MIN_HEIGHT

// On Linux (WSLg) the window is deliberately non-resizable so Chromium adds
// no invisible grab-margin (WSLg renders that margin as a visible band), and
// WM-level maximize mis-places frameless windows. Both operations are
// implemented manually with setBounds instead, which WSLg handles fine.
const useManualWindowOps = process.platform === 'linux'

const savedBoundsForMaximize = new WeakMap<BrowserWindow, Rectangle>()

function isMaximized(win: BrowserWindow): boolean {
  return useManualWindowOps ? savedBoundsForMaximize.has(win) : win.isMaximized()
}

/** Push current maximized state to the renderer so it can square its corners. */
export function emitMaximizedState(win: BrowserWindow): void {
  win.webContents.send(IpcChannels.windowMaximizedChanged, isMaximized(win))
}

const RESIZE_EDGES = [
  'left',
  'right',
  'top',
  'bottom',
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right'
] as const

type ResizeEdge = (typeof RESIZE_EDGES)[number]

interface ResizeDrag {
  edge: ResizeEdge
  startBounds: Rectangle
  startX: number
  startY: number
  timer: NodeJS.Timeout
  startedAt: number
  lastApplied: Rectangle
}

const activeResizes = new WeakMap<BrowserWindow, ResizeDrag>()

// Renderer only signals start/end; the drag itself is driven by a
// main-process cursor poll (see registerWindowControlsIpc).
const ResizePayloadSchema = z.object({
  edge: z.enum(RESIZE_EDGES),
  phase: z.enum(['start', 'end'])
})

const RESIZE_TICK_MS = 16
const RESIZE_MAX_DURATION_MS = 60_000

function manualToggleMaximize(win: BrowserWindow): void {
  const saved = savedBoundsForMaximize.get(win)
  if (saved) {
    savedBoundsForMaximize.delete(win)
    win.setBounds(saved)
    return
  }
  savedBoundsForMaximize.set(win, win.getBounds())
  win.setBounds(screen.getDisplayMatching(win.getBounds()).workArea)
}

// Pure function of the drag's fixed starting state and the current cursor:
// stateless per tick, so update pacing can never accumulate error. Anchored
// edges (the ones opposite the grabbed edge) are held exactly in place.
function boundsForCursor(drag: ResizeDrag, cursorX: number, cursorY: number): Rectangle {
  const dx = cursorX - drag.startX
  const dy = cursorY - drag.startY
  const s = drag.startBounds
  const b = { ...s }
  const edge = drag.edge

  // Edge names compose ("bottom-right" grows width and height), so match on
  // substrings. The moving edge shifts x/y; the anchored edge stays put.
  if (edge.includes('right')) {
    b.width = Math.max(MIN_WIDTH, s.width + dx)
  }
  if (edge.includes('left')) {
    b.width = Math.max(MIN_WIDTH, s.width - dx)
    b.x = s.x + (s.width - b.width)
  }
  if (edge.includes('bottom')) {
    b.height = Math.max(MIN_HEIGHT, s.height + dy)
  }
  if (edge.includes('top')) {
    b.height = Math.max(MIN_HEIGHT, s.height - dy)
    b.y = s.y + (s.height - b.height)
  }

  return b
}

function boundsEqual(a: Rectangle, b: Rectangle): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
}

function endResize(win: BrowserWindow): void {
  const drag = activeResizes.get(win)
  if (!drag) return
  clearInterval(drag.timer)
  activeResizes.delete(win)
}

function startResize(win: BrowserWindow, edge: ResizeEdge): void {
  endResize(win)

  const cursor = screen.getCursorScreenPoint()
  const drag: ResizeDrag = {
    edge,
    startBounds: win.getBounds(),
    startX: cursor.x,
    startY: cursor.y,
    startedAt: Date.now(),
    lastApplied: win.getBounds(),
    // Fixed-rate main-side cursor poll instead of renderer mousemove
    // coordinates: the renderer's screenX/Y are derived from a window
    // origin that lags while the window itself moves (left/top drags),
    // which wobbles the bounds. Polling the OS cursor is authoritative
    // and updates at an even cadence regardless of event bursts.
    timer: setInterval(() => {
      if (win.isDestroyed() || Date.now() - drag.startedAt > RESIZE_MAX_DURATION_MS) {
        endResize(win)
        return
      }
      const point = screen.getCursorScreenPoint()
      const next = boundsForCursor(drag, point.x, point.y)
      if (boundsEqual(next, drag.lastApplied)) return
      drag.lastApplied = next
      win.setBounds(next)
    }, RESIZE_TICK_MS)
  }
  activeResizes.set(win, drag)
}

export function registerWindowControlsIpc(): void {
  ipcMain.on(IpcChannels.windowMinimize, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })

  ipcMain.on(IpcChannels.windowToggleMaximize, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    if (useManualWindowOps) {
      manualToggleMaximize(win)
      // Manual setBounds doesn't fire native maximize/unmaximize events, so
      // notify the renderer explicitly. (Windows fires those events, handled
      // by listeners attached in managementWindow.ts.)
      emitMaximizedState(win)
    } else if (win.isMaximized()) {
      win.unmaximize()
    } else {
      win.maximize()
    }
  })

  // `close` emits the window's regular close event, so the management
  // window's hide-instead-of-quit behavior stays in one place.
  ipcMain.on(IpcChannels.windowClose, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })

  ipcMain.on(IpcChannels.windowResize, (event, rawPayload: unknown) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    const { edge, phase } = ResizePayloadSchema.parse(rawPayload)

    if (phase === 'start') {
      startResize(win, edge)
    } else {
      endResize(win)
    }
  })
}
