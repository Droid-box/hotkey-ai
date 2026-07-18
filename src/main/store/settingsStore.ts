import Store from 'electron-store'
import type { AppSettings, ChatWindowSize } from '../../preload/shared/types'

// App-wide preferences (distinct from window-state.json and assistants.json).
// Small on purpose — one entry today (chat window size); more can slot in
// alongside without a schema migration.
const DEFAULT_SETTINGS: AppSettings = { chatWindowSize: 'small' }

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
