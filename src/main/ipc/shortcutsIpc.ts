import { globalShortcut, ipcMain } from 'electron'
import { z } from 'zod'
import { IpcChannels } from '../../preload/shared/ipcChannels'
import type { ShortcutCheckResult } from '../../preload/shared/types'
import {
  findDuplicateAssistant,
  normalizeAccelerator,
  validateAccelerator
} from '../../preload/shared/accelerator'
import type { AssistantStore } from '../store/assistantStore'

const AcceleratorSchema = z.string().min(1).max(60)
const ExcludeIdSchema = z.string().optional()

export function registerShortcutsIpc(store: AssistantStore): void {
  ipcMain.handle(
    IpcChannels.shortcutCheckConflict,
    (_event, rawAccelerator: unknown, rawExcludeId: unknown): ShortcutCheckResult => {
      const accelerator = normalizeAccelerator(AcceleratorSchema.parse(rawAccelerator))
      const excludeId = ExcludeIdSchema.parse(rawExcludeId)

      const validity = validateAccelerator(accelerator)
      if (!validity.ok) return validity

      const duplicate = findDuplicateAssistant(accelerator, store.list(), excludeId)
      if (duplicate) {
        return { ok: false, reason: `Already used by “${duplicate.name}”.` }
      }

      // Unchanged from this assistant's current shortcut: we hold the OS
      // registration ourselves, so a probe would falsely report a conflict.
      if (excludeId) {
        const current = store.get(excludeId)?.shortcut
        if (current && normalizeAccelerator(current) === accelerator) {
          return { ok: true, reason: null }
        }
      }

      // OS-level probe: register momentarily to see if another application
      // owns the combo. Electron gives no reason string — only pass/fail.
      let registered = false
      try {
        registered = globalShortcut.register(accelerator, () => {})
      } catch {
        return { ok: false, reason: 'Invalid shortcut.' }
      }
      if (!registered) {
        return { ok: false, reason: 'This shortcut is in use by another application.' }
      }
      globalShortcut.unregister(accelerator)
      return { ok: true, reason: null }
    }
  )
}
