import { app } from 'electron'

// Mirror the stored "launch at startup" preference into the OS login-item
// registry. setLoginItemSettings is only meaningful on Windows/macOS; it's a
// no-op under Linux/WSLg, so skip it there.
export function applyLaunchAtStartup(enabled: boolean): void {
  if (process.platform === 'linux') return
  app.setLoginItemSettings({ openAtLogin: enabled })
}
