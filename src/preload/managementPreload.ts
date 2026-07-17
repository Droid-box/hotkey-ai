import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannels } from './shared/ipcChannels'
import type {
  ApiKeyInfo,
  ApiKeyStatus,
  Assistant,
  AssistantInput,
  ManagementBridge,
  ModelListResult,
  ProviderId,
  ResizeEdge,
  ResizePhase,
  ShortcutCheckResult,
  TestApiKeyResult
} from './shared/types'

const bridge: ManagementBridge = {
  appName: 'Hotkey AI',
  platform: process.platform,
  shortcuts: {
    checkConflict: (accelerator: string, excludeId?: string): Promise<ShortcutCheckResult> =>
      ipcRenderer.invoke(IpcChannels.shortcutCheckConflict, accelerator, excludeId)
  },
  assistants: {
    list: (): Promise<Assistant[]> => ipcRenderer.invoke(IpcChannels.assistantList),
    create: (input: AssistantInput): Promise<Assistant> =>
      ipcRenderer.invoke(IpcChannels.assistantCreate, input),
    update: (id: string, input: AssistantInput): Promise<Assistant> =>
      ipcRenderer.invoke(IpcChannels.assistantUpdate, id, input),
    delete: (id: string): Promise<void> => ipcRenderer.invoke(IpcChannels.assistantDelete, id),
    onUpdated: (callback: () => void): (() => void) => {
      const listener = (): void => callback()
      ipcRenderer.on(IpcChannels.assistantUpdated, listener)
      return () => ipcRenderer.removeListener(IpcChannels.assistantUpdated, listener)
    }
  },
  secrets: {
    setApiKey: (provider: ProviderId, key: string): Promise<ApiKeyStatus> =>
      ipcRenderer.invoke(IpcChannels.secretsSetApiKey, provider, key),
    getApiKeyStatus: (provider: ProviderId): Promise<ApiKeyStatus> =>
      ipcRenderer.invoke(IpcChannels.secretsGetApiKeyStatus, provider),
    deleteApiKey: (provider: ProviderId): Promise<void> =>
      ipcRenderer.invoke(IpcChannels.secretsDeleteApiKey, provider),
    testApiKey: (provider: ProviderId, key: string): Promise<TestApiKeyResult> =>
      ipcRenderer.invoke(IpcChannels.secretsTestApiKey, provider, key),
    listApiKeys: (): Promise<ApiKeyInfo[]> => ipcRenderer.invoke(IpcChannels.secretsListApiKeys)
  },
  models: {
    list: (provider: ProviderId): Promise<ModelListResult> =>
      ipcRenderer.invoke(IpcChannels.modelsList, provider)
  },
  windowControls: {
    minimize: (): void => ipcRenderer.send(IpcChannels.windowMinimize),
    toggleMaximize: (): void => ipcRenderer.send(IpcChannels.windowToggleMaximize),
    close: (): void => ipcRenderer.send(IpcChannels.windowClose),
    resize: (edge: ResizeEdge, phase: ResizePhase, screenX: number, screenY: number): void =>
      ipcRenderer.send(IpcChannels.windowResize, { edge, phase, screenX, screenY })
  }
}

contextBridge.exposeInMainWorld('hotkeyAI', bridge)
