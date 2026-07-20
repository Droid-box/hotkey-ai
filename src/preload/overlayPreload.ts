import { clipboard, contextBridge, ipcRenderer } from 'electron'
import { IpcChannels } from './shared/ipcChannels'
import type {
  ChatMessage,
  ChatStreamChunk,
  ChatStreamEnd,
  ChatStreamError,
  ConversationList,
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
  resizeContent: (contentHeight: number): void => {
    ipcRenderer.send(IpcChannels.overlayResizeContent, contentHeight)
  },
  setPinned: (pinned: boolean): void => {
    ipcRenderer.send(IpcChannels.overlaySetPinned, pinned)
  },
  openApiKeys: (): void => {
    ipcRenderer.send(IpcChannels.overlayOpenApiKeys)
  },
  setHistoryOpen: (open: boolean): void => {
    ipcRenderer.send(IpcChannels.overlaySetHistoryOpen, open)
  },
  conversations: {
    list: (assistantId: string): Promise<ConversationList> =>
      ipcRenderer.invoke(IpcChannels.conversationsList, { assistantId }),
    open: (assistantId: string, conversationId: string): Promise<ChatMessage[]> =>
      ipcRenderer.invoke(IpcChannels.conversationsOpen, { assistantId, conversationId }),
    delete: (assistantId: string, conversationId: string): Promise<ConversationList> =>
      ipcRenderer.invoke(IpcChannels.conversationsDelete, { assistantId, conversationId }),
    deleteMany: (assistantId: string, conversationIds: string[]): Promise<ConversationList> =>
      ipcRenderer.invoke(IpcChannels.conversationsDeleteMany, { assistantId, conversationIds }),
    onChanged: subscribe<{ assistantId: string; list: ConversationList }>(
      IpcChannels.conversationsChanged
    )
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
