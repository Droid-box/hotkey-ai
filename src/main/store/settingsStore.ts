import Store from 'electron-store'
import type { AppSettings, ChatWindowSize } from '../../preload/shared/types'

// App-wide preferences (distinct from window-state.json and assistants.json).
// Defaults are spread over the stored value on load, so a new field like
// chatWindowOpacity reads its default for users whose settings.json predates
// it — no schema migration needed. Opacity 1 = fully opaque.
const DEFAULT_SETTINGS: AppSettings = { chatWindowSize: 'small', chatWindowOpacity: 1 }

const store = new Store<{ settings: AppSettings }>({
  name: 'settings',
  defaults: { settings: DEFAULT_SETTINGS }
})

export function loadSettings(): AppSettings {
  return { ...DEFAULT_SETTINGS, ...store.get('settings') }
}

export function getChatWindowSize(): ChatWindowSize {
  return loadSettings().chatWindowSize
}

export function setChatWindowSize(size: ChatWindowSize): void {
  store.set('settings', { ...loadSettings(), chatWindowSize: size })
}

export function getChatWindowOpacity(): number {
  return loadSettings().chatWindowOpacity
}

export function setChatWindowOpacity(opacity: number): void {
  store.set('settings', { ...loadSettings(), chatWindowOpacity: opacity })
}
