import { screen, type BrowserWindow, type Rectangle } from 'electron'

// The window's last known non-maximized ("normal") bounds, tracked
// independently of the OS restore state — the setResizable-on-maximize toggle
// (windowControlsIpc/managementWindow) can reset Windows' native restore
// bounds, so we remember them ourselves to un-maximize back to the exact
// previous windowed size and position.
const normalBoundsMap = new WeakMap<BrowserWindow, Rectangle>()

export function rememberNormalBounds(win: BrowserWindow): void {
  if (win.isDestroyed() || win.isMaximized() || win.isMinimized() || win.isFullScreen()) return
  const bounds = win.getBounds()
  // Guard the maximize race: maximizing fires a 'resize' whose bounds are
  // already full-screen a beat before isMaximized() flips true (and a
  // multi-monitor maximize can even spill past one display). Ignore bounds that
  // fill or exceed the display's work area, so the maximized rectangle is never
  // mistaken for the "normal" one and used as the restore target.
  const { workArea } = screen.getDisplayMatching(bounds)
  if (bounds.width >= workArea.width && bounds.height >= workArea.height) return
  normalBoundsMap.set(win, bounds)
}

export function getNormalBounds(win: BrowserWindow): Rectangle | undefined {
  return normalBoundsMap.get(win)
}
