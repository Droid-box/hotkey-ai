import { BrowserWindow, ipcMain } from 'electron'
import { IpcChannels } from '../../preload/shared/ipcChannels'
import type { Assistant } from '../../preload/shared/types'
import { AssistantInputSchema } from '../store/schema'
import type { AssistantStore } from '../store/assistantStore'
import { conversationCache } from '../chat/conversationCache'

// Broadcasts to every open window (management + overlay) so a currently-open
// overlay can pick up an edited system prompt/model/provider without a restart.
function broadcastAssistantsUpdated(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(IpcChannels.assistantUpdated)
  }
}

export function registerAssistantsIpc(store: AssistantStore, onChanged?: () => void): void {
  const notifyChanged = (): void => {
    onChanged?.()
    broadcastAssistantsUpdated()
  }

  ipcMain.handle(IpcChannels.assistantList, (): Assistant[] => store.list())

  ipcMain.handle(IpcChannels.assistantCreate, (_event, rawInput: unknown): Assistant => {
    const input = AssistantInputSchema.parse(rawInput)
    const created = store.create(input)
    notifyChanged()
    return created
  })

  ipcMain.handle(IpcChannels.assistantUpdate, (_event, id: unknown, rawInput: unknown): Assistant => {
    if (typeof id !== 'string') throw new Error('Assistant id must be a string')
    const input = AssistantInputSchema.parse(rawInput)
    const updated = store.update(id, input)
    notifyChanged()
    return updated
  })

  ipcMain.handle(IpcChannels.assistantDelete, (_event, id: unknown): void => {
    if (typeof id !== 'string') throw new Error('Assistant id must be a string')
    store.delete(id)
    // Drop the deleted assistant's persisted history so a new assistant that
    // reuses the id (it won't — UUIDs) or leftover disk state can't resurface.
    conversationCache.clear(id)
    notifyChanged()
  })
}
