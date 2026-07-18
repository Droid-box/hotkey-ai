import Store from 'electron-store'
import { screen } from 'electron'

export interface ManagementWindowState {
  x?: number
  y?: number
  width: number
  height: number
  isMaximized: boolean
}

const DEFAULT_STATE: ManagementWindowState = { width: 960, height: 640, isMaximized: false }

const store = new Store<{ management: ManagementWindowState }>({
  name: 'window-state',
  defaults: { management: DEFAULT_STATE }
})

// The saved position is usable only if some part of the title bar still lands
// on a connected display (guards against a monitor being disconnected between
// runs, which would otherwise open the window off-screen).
function isOnScreen(x: number, y: number, width: number): boolean {
  return screen.getAllDisplays().some((d) => {
    const wa = d.workArea
    return x + width > wa.x && x < wa.x + wa.width && y + 40 > wa.y && y < wa.y + wa.height
  })
}

export function loadManagementWindowState(): ManagementWindowState {
  const s: ManagementWindowState = { ...DEFAULT_STATE, ...store.get('management') }
  if (s.x === undefined || s.y === undefined || !isOnScreen(s.x, s.y, s.width)) {
    delete s.x
    delete s.y // fall back to centered
  }
  return s
}

export function saveManagementWindowState(state: ManagementWindowState): void {
  store.set('management', state)
}
