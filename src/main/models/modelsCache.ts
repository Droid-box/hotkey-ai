import Store from 'electron-store'
import type { ModelListResult, ProviderId } from '../../preload/shared/types'
import { getProvider } from '../providers/registry'
import { secretsStore } from '../store/secretsStore'

const TTL_MS = 60 * 60 * 1000 // refetch at most hourly

interface CacheEntry {
  models: string[]
  fetchedAt: string
}

// Persisted so dropdowns populate instantly (and offline) across restarts.
const store = new Store<{ cache: Partial<Record<ProviderId, CacheEntry>> }>({
  name: 'models-cache',
  defaults: { cache: {} }
})

function isFresh(entry: CacheEntry): boolean {
  return Date.now() - new Date(entry.fetchedAt).getTime() < TTL_MS
}

export async function listModels(provider: ProviderId, force = false): Promise<ModelListResult> {
  const cached = store.get('cache')[provider]

  if (cached && isFresh(cached) && !force) {
    return { models: cached.models, error: null }
  }

  const apiKey = secretsStore.getApiKey(provider)
  if (!apiKey) {
    return {
      models: cached?.models ?? [],
      error: 'No API key configured for this provider yet — enter a model name manually.'
    }
  }

  try {
    const models = await getProvider(provider).listModels(apiKey)
    store.set(`cache.${provider}`, { models, fetchedAt: new Date().toISOString() })
    return { models, error: null }
  } catch (err) {
    // A stale list beats no list; surface the failure only if we have nothing.
    if (cached) return { models: cached.models, error: null }
    return {
      models: [],
      error: `Couldn't load models: ${err instanceof Error ? err.message : String(err)}`
    }
  }
}
