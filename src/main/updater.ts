import { app, BrowserWindow, ipcMain } from 'electron'
import electronUpdater from 'electron-updater'
import { IpcChannels } from '../preload/shared/ipcChannels'
import type { UpdateState } from '../preload/shared/types'
import { getAutoInstallUpdates } from './store/settingsStore'
import { setTrayUpdate } from './tray'

// electron-updater is CommonJS; grab autoUpdater off the default export.
const { autoUpdater } = electronUpdater

const INITIAL_DELAY_MS = 8_000
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000 // every 6 hours

let state: UpdateState = {
  status: 'idle',
  currentVersion: app.getVersion(),
  newVersion: null,
  percent: 0,
  error: null
}

function setState(patch: Partial<UpdateState>): void {
  state = { ...state, ...patch }
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(IpcChannels.updatesStateChanged, state)
  }
  // Show a tray "Restart to update" item only once an update is downloaded.
  setTrayUpdate(
    state.status === 'downloaded' && state.newVersion
      ? { version: state.newVersion, onInstall: installUpdate }
      : null
  )
}

function toMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err ?? 'Update failed')
}

export function getUpdateState(): UpdateState {
  return state
}

// electron-updater only runs from a packaged/installed build (it needs the
// real app-update.yml and a version to compare). In dev it's a no-op.
export function initUpdater(): void {
  if (!app.isPackaged) {
    state = { ...state, status: 'dev' }
    return
  }

  autoUpdater.autoDownload = getAutoInstallUpdates()
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => setState({ status: 'checking', error: null }))
  autoUpdater.on('update-available', (info) =>
    setState({ status: 'available', newVersion: info.version, error: null })
  )
  autoUpdater.on('update-not-available', () => setState({ status: 'not-available', error: null }))
  autoUpdater.on('download-progress', (p) =>
    setState({ status: 'downloading', percent: Math.round(p.percent) })
  )
  autoUpdater.on('update-downloaded', (info) =>
    setState({ status: 'downloaded', newVersion: info.version, percent: 100 })
  )
  autoUpdater.on('error', (err) => setState({ status: 'error', error: toMessage(err) }))

  setTimeout(checkForUpdates, INITIAL_DELAY_MS)
  setInterval(checkForUpdates, CHECK_INTERVAL_MS)
}

export function checkForUpdates(): void {
  if (!app.isPackaged) return
  autoUpdater.checkForUpdates().catch((err) => setState({ status: 'error', error: toMessage(err) }))
}

// Download on demand when auto-install is off and an update is available.
export function downloadUpdate(): void {
  if (!app.isPackaged) return
  autoUpdater.downloadUpdate().catch((err) => setState({ status: 'error', error: toMessage(err) }))
}

export function installUpdate(): void {
  if (!app.isPackaged) return
  // Not silent, and relaunch after installing.
  autoUpdater.quitAndInstall(false, true)
}

// Toggle background auto-download when the "Automatically install updates"
// setting changes.
export function setUpdateAutoDownload(enabled: boolean): void {
  if (!app.isPackaged) return
  autoUpdater.autoDownload = enabled
}

export function registerUpdatesIpc(): void {
  ipcMain.handle(IpcChannels.updatesGetState, (): UpdateState => state)
  ipcMain.on(IpcChannels.updatesCheck, () => checkForUpdates())
  ipcMain.on(IpcChannels.updatesDownload, () => downloadUpdate())
  ipcMain.on(IpcChannels.updatesInstall, () => installUpdate())
}
