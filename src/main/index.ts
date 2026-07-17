import { app, Menu } from 'electron'
import { createTray } from './tray'
import { managementWindowManager } from './windows/managementWindow'
import { overlayWindowManager } from './windows/overlayWindow'
import { registerAssistantsIpc } from './ipc/assistantsIpc'
import { registerOverlayIpc } from './ipc/overlayIpc'
import { registerShortcutsIpc } from './ipc/shortcutsIpc'
import { registerSecretsIpc } from './ipc/secretsIpc'
import { registerChatIpc } from './ipc/chatIpc'
import { registerModelsIpc } from './ipc/modelsIpc'
import { registerWindowControlsIpc } from './ipc/windowControlsIpc'
import { assistantStore } from './store/assistantStore'
import { shortcutManager } from './shortcuts/shortcutManager'
import { conversationCache } from './chat/conversationCache'
import { startDevServerWatchdog } from './lib/devServerWatchdog'

function openAssistantOverlay(assistantId: string): void {
  const assistant = assistantStore.get(assistantId)
  if (!assistant) return
  overlayWindowManager.showFor({
    assistant: {
      id: assistant.id,
      name: assistant.name,
      provider: assistant.provider,
      model: assistant.model
    },
    history: conversationCache.get(assistant.id)
  })
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
    registerModelsIpc()
    registerWindowControlsIpc()

    overlayWindowManager.create()
    syncShortcuts()
    shortcutManager.watchPowerEvents(shortcutEntries)

    createTray()
    managementWindowManager.showOrCreate()

    const rendererUrl = process.env['ELECTRON_RENDERER_URL']
    if (rendererUrl) startDevServerWatchdog(rendererUrl)
  })

  // Hotkey AI is a tray-resident app: closing every window must not quit it.
  // Only the tray's Quit item (which calls app.quit()) should trigger exit.
  app.on('window-all-closed', () => {
    // intentionally not calling app.quit()
  })

  app.on('will-quit', () => shortcutManager.unregisterAll())
}
