import { app, BrowserWindow, clipboard, Menu, nativeTheme } from 'electron'
import { IpcChannels } from '../preload/shared/ipcChannels'
import { createTray } from './tray'
import { managementWindowManager } from './windows/managementWindow'
import { overlayWindowManager } from './windows/overlayWindow'
import { registerAssistantsIpc } from './ipc/assistantsIpc'
import { registerOverlayIpc } from './ipc/overlayIpc'
import { registerShortcutsIpc } from './ipc/shortcutsIpc'
import { registerSecretsIpc } from './ipc/secretsIpc'
import { registerChatIpc, resetConversation } from './ipc/chatIpc'
import { registerTestChatIpc } from './ipc/testChatIpc'
import { registerModelsIpc } from './ipc/modelsIpc'
import { registerSettingsIpc } from './ipc/settingsIpc'
import { registerWindowControlsIpc } from './ipc/windowControlsIpc'
import { assistantStore } from './store/assistantStore'
import { getLaunchAtStartup, getTheme } from './store/settingsStore'
import { applyLaunchAtStartup, wasLaunchedAtStartup } from './lib/loginItem'
import { applyThemeSource } from './lib/theme'
import { shortcutManager } from './shortcuts/shortcutManager'
import { conversationCache } from './chat/conversationCache'
import { startDevServerWatchdog } from './lib/devServerWatchdog'

// Under X11/WSLg, Electron falls back to the oversized black X11 core
// cursors when no cursor theme is selected (XCURSOR_* unset), even though
// our CSS only uses standard system cursors. Point it at an installed
// theme at a normal size before the X connection opens. Linux-only; no
// effect on Windows/macOS builds. Respect any value the user already set.
if (process.platform === 'linux') {
  process.env['XCURSOR_THEME'] ||= 'Adwaita'
  process.env['XCURSOR_SIZE'] ||= '24'
}

function openAssistantOverlay(assistantId: string): void {
  const assistant = assistantStore.get(assistantId)
  if (!assistant) return

  // Pressing the assistant's shortcut while its chat is already open acts
  // as "start a new chat": abort any in-flight response, wipe history.
  if (overlayWindowManager.isShowingAssistant(assistantId)) {
    resetConversation(assistantId)
  }

  overlayWindowManager.showFor({
    assistant: {
      id: assistant.id,
      name: assistant.name,
      provider: assistant.provider,
      model: assistant.model
    },
    history: conversationCache.get(assistant.id),
    // Stage the clipboard in the input when the assistant opts in, so its
    // hotkey acts on whatever the user just copied.
    prefill: assistant.prefillClipboard ? clipboard.readText() : undefined
  }, !!assistant.resetChatOnClose)
}

// Each assistant with a recorded shortcut gets its own global registration;
// re-synced on startup and after every assistant create/update/delete.
function shortcutEntries(): { assistantId: string; accelerator: string }[] {
  return assistantStore
    .list()
    .filter((a) => a.shortcut)
    .map((a) => ({ assistantId: a.id, accelerator: a.shortcut }))
}

function syncShortcuts(): void {
  shortcutManager.registerAll(shortcutEntries(), openAssistantOverlay)
  // Tell any open window which assistants' shortcuts the OS refused, so the
  // management list can flag them instead of the failure being silent.
  const failed = shortcutManager.getFailedAssistantIds()
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(IpcChannels.shortcutFailuresChanged, failed)
  }
}

// WSLg's GPU passthrough is flaky (windows can render blank grey while the
// app paints fine internally). Software rendering is plenty for this UI;
// Windows builds are unaffected.
if (process.platform === 'linux') {
  app.disableHardwareAcceleration()
}

const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  console.log(
    'Hotkey AI is already running — this instance will exit. ' +
      'Look for the existing tray icon/window, or stop the other `npm run dev` first.'
  )
  app.quit()
} else {
  app.on('second-instance', () => managementWindowManager.showOrCreate())

  app.whenReady().then(() => {
    // Drop Electron's default File/Edit/View/Window menu — this is a
    // tray-resident utility, all actions live in its own UI.
    Menu.setApplicationMenu(null)

    registerAssistantsIpc(assistantStore, syncShortcuts)
    registerOverlayIpc()
    registerShortcutsIpc(assistantStore)
    registerSecretsIpc()
    registerChatIpc(assistantStore)
    registerTestChatIpc(assistantStore)
    registerModelsIpc()
    registerSettingsIpc()
    registerWindowControlsIpc()

    // Apply the saved theme before any window is created so they open in the
    // right palette (this sets prefers-color-scheme for every renderer).
    applyThemeSource(getTheme())
    // Keep the management window's native background in sync when the OS theme
    // changes while the user is on 'system'.
    nativeTheme.on('updated', () => managementWindowManager.refreshThemeBackground())

    // Load persisted conversations before the overlay can be summoned.
    conversationCache.init()

    // Re-assert the OS login item from our stored preference, in case it was
    // changed outside the app (e.g. Task Manager > Startup).
    applyLaunchAtStartup(getLaunchAtStartup())

    overlayWindowManager.create()
    // Assistants with "reset chat on close" wipe their conversation when the
    // overlay is dismissed; the window manager fires this on hide.
    overlayWindowManager.setOnCloseReset(resetConversation)
    syncShortcuts()
    shortcutManager.watchPowerEvents(shortcutEntries)

    createTray()
    // A Windows-startup launch stays in the tray (hotkeys and the overlay are
    // already live); only a manual launch opens the management window. The user
    // can open it anytime from the tray icon.
    if (!wasLaunchedAtStartup()) {
      managementWindowManager.showOrCreate()
    }

    const rendererUrl = process.env['ELECTRON_RENDERER_URL']
    if (rendererUrl) {
      startDevServerWatchdog(rendererUrl)
      // Dev-only: lets headless verification (main-process inspector) drive
      // the exact code path a global shortcut press takes.
      ;(globalThis as Record<string, unknown>)['__hotkeyDebug'] = {
        openAssistantOverlay,
        conversationCache
      }
    }
  })

  // Hotkey AI is a tray-resident app: closing every window must not quit it.
  // Only the tray's Quit item (which calls app.quit()) should trigger exit.
  app.on('window-all-closed', () => {
    // intentionally not calling app.quit()
  })

  app.on('will-quit', () => shortcutManager.unregisterAll())
}
