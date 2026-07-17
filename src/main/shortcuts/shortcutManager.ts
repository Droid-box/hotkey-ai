import { globalShortcut, powerMonitor } from 'electron'

interface RegisteredShortcut {
  assistantId: string
  accelerator: string
}

class ShortcutManager {
  private registered: RegisteredShortcut[] = []
  private onTrigger: ((assistantId: string) => void) | null = null

  // Re-registers everything on every call rather than diffing — this app
  // only ever has a handful of assistants, so the simplicity is worth more
  // than the (negligible) cost of a full unregister/register pass.
  registerAll(shortcuts: RegisteredShortcut[], onTrigger: (assistantId: string) => void): void {
    this.onTrigger = onTrigger
    globalShortcut.unregisterAll()
    this.registered = []

    for (const { assistantId, accelerator } of shortcuts) {
      if (!accelerator) continue
      const ok = globalShortcut.register(accelerator, () => this.onTrigger?.(assistantId))
      if (ok) {
        this.registered.push({ assistantId, accelerator })
      } else {
        console.warn(
          `Hotkey AI: could not register shortcut "${accelerator}" for assistant ${assistantId} — it may already be in use by another application.`
        )
      }
    }
  }

  unregisterAll(): void {
    globalShortcut.unregisterAll()
    this.registered = []
  }

  // Windows can silently drop global shortcut registrations across sleep/lock;
  // re-assert them defensively when the system comes back.
  watchPowerEvents(shortcuts: () => RegisteredShortcut[]): void {
    const reregister = (): void => {
      if (this.onTrigger) this.registerAll(shortcuts(), this.onTrigger)
    }
    powerMonitor.on('resume', reregister)
    powerMonitor.on('unlock-screen', reregister)
  }
}

export const shortcutManager = new ShortcutManager()
