import { app } from 'electron'

// Passed to the OS login-item registration so a launch triggered by Windows
// startup carries this flag in process.argv, letting us tell it apart from a
// manual launch and start hidden in the tray.
export const STARTUP_HIDDEN_ARG = '--startup-hidden'

// Mirror the stored "launch at startup" preference into the OS login-item
// registry. setLoginItemSettings is only meaningful on Windows/macOS; it's a
// no-op under Linux/WSLg, so skip it there.
export function applyLaunchAtStartup(enabled: boolean): void {
  if (process.platform === 'linux') return
  app.setLoginItemSettings({ openAtLogin: enabled, args: [STARTUP_HIDDEN_ARG] })
}

// True when this process was auto-started by the OS login item (rather than
// launched manually), signalled by the marker arg we registered above.
export function wasLaunchedAtStartup(): boolean {
  return process.argv.includes(STARTUP_HIDDEN_ARG)
}
