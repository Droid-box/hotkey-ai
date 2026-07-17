import type { ProviderId } from '../../preload/shared/types'
import type { AIProvider } from './types'
import { openaiProvider } from './openaiProvider'
import { anthropicProvider } from './anthropicProvider'

// Adding a provider (Gemini, Ollama, …) is one new file implementing
// AIProvider plus one entry here — extend ProviderId in shared/types.ts
// and the PROVIDER_OPTIONS list in the management UI.
const providers: Record<ProviderId, AIProvider> = {
  openai: openaiProvider,
  anthropic: anthropicProvider
}

export function getProvider(id: ProviderId): AIProvider {
  return providers[id]
}
