import { app, Menu } from 'electron'
import { createTray } from './tray'
import { managementWindowManager } from './windows/managementWindow'
import { overlayWindowManager } from './windows/overlayWindow'
import { registerAssistantsIpc } from './ipc/assistantsIpc'
import { registerOverlayIpc } from './ipc/overlayIpc'
import { registerSecretsIpc } from './ipc/secretsIpc'
import { registerChatIpc } from './ipc/chatIpc'
import { registerModelsIpc } from './ipc/modelsIpc'
import { assistantStore } from './store/assistantStore'
import { shortcutManager } from './shortcuts/shortcutManager'
import { conversationCache } from './chat/conversationCache'

// Single app-wide shortcut until M5 adds per-assistant shortcut recording:
// opens the first assistant in the store (or an empty state if none exist).
const GLOBAL_SHORTCUT = { assistantId: 'primary', accelerator: 'CommandOrControl+Shift+H' }

function openAssistantOverlay(): void {
  const first = assistantStore.list()[0]
  if (!first) {
    overlayWindowManager.showFor({ assistant: null, history: [] })
    return
  }
  overlayWindowManager.showFor({
    assistant: { id: first.id, name: first.name, provider: first.provider, model: first.model },
    history: conversationCache.get(first.id)
  })
}

const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => managementWindowManager.showOrCreate())

  app.whenReady().then(() => {
    // Drop Electron's default File/Edit/View/Window menu — this is a
    // tray-resident utility, all actions live in its own UI.
    Menu.setApplicationMenu(null)

    registerAssistantsIpc(assistantStore)
    registerOverlayIpc()
    registerSecretsIpc()
    registerChatIpc(assistantStore)
    registerModelsIpc()

    overlayWindowManager.create()
    shortcutManager.registerAll([GLOBAL_SHORTCUT], openAssistantOverlay)
    shortcutManager.watchPowerEvents(() => [GLOBAL_SHORTCUT])

    createTray()
    managementWindowManager.showOrCreate()
  })

  // Hotkey AI is a tray-resident app: closing every window must not quit it.
  // Only the tray's Quit item (which calls app.quit()) should trigger exit.
  app.on('window-all-closed', () => {
    // intentionally not calling app.quit()
  })

  app.on('will-quit', () => shortcutManager.unregisterAll())
}
