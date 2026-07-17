import { safeStorage } from 'electron'
import Store from 'electron-store'
import type { ApiKeyInfo, ApiKeyStatus, ProviderId } from '../../preload/shared/types'

// Marks values stored without OS-level encryption (Linux dev sessions with
// no keyring, e.g. WSL). On Windows, safeStorage always has DPAPI, so
// shipped builds never take this path.
const PLAINTEXT_PREFIX = 'insecure-plain:'

// Older entries were bare encrypted strings; newer ones carry metadata.
type StoredKey = string | { value: string; addedAt: string }

interface SecretsShape {
  keys: Partial<Record<ProviderId, StoredKey>>
}

const store = new Store<SecretsShape>({
  name: 'secrets',
  defaults: { keys: {} }
})

function encrypt(plaintext: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(plaintext).toString('base64')
  }
  console.warn(
    'Hotkey AI: OS-level encryption unavailable (no keyring?) — storing API key obfuscation-free. ' +
      'This should never happen on Windows.'
  )
  return PLAINTEXT_PREFIX + Buffer.from(plaintext, 'utf8').toString('base64')
}

function decrypt(stored: string): string {
  if (stored.startsWith(PLAINTEXT_PREFIX)) {
    return Buffer.from(stored.slice(PLAINTEXT_PREFIX.length), 'base64').toString('utf8')
  }
  return safeStorage.decryptString(Buffer.from(stored, 'base64'))
}

function mask(key: string): string {
  if (key.length <= 8) return '••••'
  return `${key.slice(0, 3)}…${key.slice(-4)}`
}

function normalize(stored: StoredKey): { value: string; addedAt: string | null } {
  return typeof stored === 'string' ? { value: stored, addedAt: null } : stored
}

export const secretsStore = {
  setApiKey(provider: ProviderId, key: string): ApiKeyStatus {
    store.set(`keys.${provider}`, { value: encrypt(key), addedAt: new Date().toISOString() })
    return { hasKey: true, masked: mask(key) }
  },

  getApiKey(provider: ProviderId): string | null {
    const stored = store.get('keys')[provider]
    return stored ? decrypt(normalize(stored).value) : null
  },

  getApiKeyStatus(provider: ProviderId): ApiKeyStatus {
    const key = this.getApiKey(provider)
    return key ? { hasKey: true, masked: mask(key) } : { hasKey: false, masked: null }
  },

  listApiKeys(): ApiKeyInfo[] {
    const keys = store.get('keys')
    return (Object.keys(keys) as ProviderId[]).map((provider) => {
      const { value, addedAt } = normalize(keys[provider]!)
      return { provider, masked: mask(decrypt(value)), addedAt }
    })
  },

  deleteApiKey(provider: ProviderId): void {
    const keys = { ...store.get('keys') }
    delete keys[provider]
    store.set('keys', keys)
  }
}
