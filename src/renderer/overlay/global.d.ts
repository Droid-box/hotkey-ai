import type { OverlayBridge } from '../../preload/shared/types'

declare global {
  interface Window {
    hotkeyAI: OverlayBridge
  }
}

export {}
