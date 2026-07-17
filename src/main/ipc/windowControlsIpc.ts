import { BrowserWindow, ipcMain, screen, type Rectangle } from 'electron'
import { z } from 'zod'
import { IpcChannels } from '../../preload/shared/ipcChannels'

const MIN_WIDTH = 640
const MIN_HEIGHT = 420

// On Linux (WSLg) the window is deliberately non-resizable so Chromium adds
// no invisible grab-margin (WSLg renders that margin as a visible band), and
// WM-level maximize mis-places frameless windows. Both operations are
// implemented manually with setBounds instead, which WSLg handles fine.
const useManualWindowOps = process.platform === 'linux'

const savedBoundsForMaximize = new WeakMap<BrowserWindow, Rectangle>()

interface ResizeDrag {
  edge: 'left' | 'right' | 'bottom' | 'bottom-left' | 'bottom-right'
  startBounds: Rectangle
  startX: number
  startY: number
}

const activeResizes = new WeakMap<BrowserWindow, ResizeDrag>()

const ResizePayloadSchema = z.object({
  edge: z.enum(['left', 'right', 'bottom', 'bottom-left', 'bottom-right']),
  phase: z.enum(['start', 'move', 'end']),
  screenX: z.number(),
  screenY: z.number()
})

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

function applyResize(win: BrowserWindow, drag: ResizeDrag, screenX: number, screenY: number): void {
  const dx = screenX - drag.startX
  const dy = screenY - drag.startY
  const b = { ...drag.startBounds }

  if (drag.edge === 'right' || drag.edge === 'bottom-right') {
    b.width = Math.max(MIN_WIDTH, drag.startBounds.width + dx)
  }
  if (drag.edge === 'left' || drag.edge === 'bottom-left') {
    const width = Math.max(MIN_WIDTH, drag.startBounds.width - dx)
    b.x = drag.startBounds.x + (drag.startBounds.width - width)
    b.width = width
  }
  if (drag.edge === 'bottom' || drag.edge === 'bottom-left' || drag.edge === 'bottom-right') {
    b.height = Math.max(MIN_HEIGHT, drag.startBounds.height + dy)
  }

  win.setBounds(b)
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
    const { edge, phase, screenX, screenY } = ResizePayloadSchema.parse(rawPayload)

    if (phase === 'start') {
      activeResizes.set(win, { edge, startBounds: win.getBounds(), startX: screenX, startY: screenY })
      return
    }

    const drag = activeResizes.get(win)
    if (!drag || drag.edge !== edge) return

    applyResize(win, drag, screenX, screenY)
    if (phase === 'end') activeResizes.delete(win)
  })
}
