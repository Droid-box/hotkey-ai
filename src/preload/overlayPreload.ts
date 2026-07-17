import { clipboard, contextBridge, ipcRenderer } from 'electron'
import { IpcChannels } from './shared/ipcChannels'
import type {
  ChatStreamChunk,
  ChatStreamEnd,
  ChatStreamError,
  OverlayBridge,
  OverlayConfigurePayload
} from './shared/types'

function subscribe<T>(channel: string): (callback: (payload: T) => void) => () => void {
  return (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: T): void => callback(payload)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  }
}

const bridge: OverlayBridge = {
  onConfigure: subscribe<OverlayConfigurePayload>(IpcChannels.overlayConfigure),
  close: (): void => {
    ipcRenderer.send(IpcChannels.overlayClose)
  },
  sendMessage: (assistantId: string, message: string): void => {
    ipcRenderer.send(IpcChannels.chatSend, { assistantId, message })
  },
  abort: (assistantId: string): void => {
    ipcRenderer.send(IpcChannels.chatAbort, { assistantId })
  },
  resetChat: (assistantId: string): void => {
    ipcRenderer.send(IpcChannels.chatReset, { assistantId })
  },
  copyText: (text: string): void => {
    clipboard.writeText(text)
  },
  onStreamChunk: subscribe<ChatStreamChunk>(IpcChannels.chatStreamChunk),
  onStreamEnd: subscribe<ChatStreamEnd>(IpcChannels.chatStreamEnd),
  onStreamError: subscribe<ChatStreamError>(IpcChannels.chatStreamError)
}

contextBridge.exposeInMainWorld('hotkeyAI', bridge)
