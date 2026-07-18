import type { BrowserWindow, Rectangle } from 'electron'

// The window's last known non-maximized ("normal") bounds, tracked
// independently of the OS restore state — the setResizable-on-maximize toggle
// (windowControlsIpc/managementWindow) can reset Windows' native restore
// bounds, so we remember them ourselves to un-maximize back to the exact
// previous windowed size and position.
const normalBoundsMap = new WeakMap<BrowserWindow, Rectangle>()

export function rememberNormalBounds(win: BrowserWindow): void {
  if (win.isDestroyed() || win.isMaximized() || win.isMinimized()) return
  normalBoundsMap.set(win, win.getBounds())
}

export function getNormalBounds(win: BrowserWindow): Rectangle | undefined {
  return normalBoundsMap.get(win)
}
