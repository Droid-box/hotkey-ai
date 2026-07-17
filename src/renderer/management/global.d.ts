import type { ManagementBridge } from '../../preload/shared/types'

declare global {
  interface Window {
    hotkeyAI: ManagementBridge
  }
}

export {}
