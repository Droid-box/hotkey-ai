import Store from 'electron-store'
import { randomUUID } from 'node:crypto'
import type { Assistant, AssistantInput } from '../../preload/shared/types'

interface StoreShape {
  assistants: Assistant[]
}

export interface AssistantStore {
  list(): Assistant[]
  get(id: string): Assistant | undefined
  create(input: AssistantInput): Assistant
  update(id: string, input: AssistantInput): Assistant
  delete(id: string): void
}

// Factory (rather than a bare module-level singleton) so tests can pass an
// isolated `cwd` and get a throwaway store instead of touching userData.
export function createAssistantStore(options?: { cwd?: string }): AssistantStore {
  const store = new Store<StoreShape>({
    name: 'assistants',
    cwd: options?.cwd,
    defaults: { assistants: [] }
  })

  const list = (): Assistant[] => store.get('assistants')
  const get = (id: string): Assistant | undefined => list().find((a) => a.id === id)

  return {
    list,
    get,
    create(input: AssistantInput): Assistant {
      const now = new Date().toISOString()
      const assistant: Assistant = {
        id: randomUUID(),
        ...input,
        createdAt: now,
        updatedAt: now
      }
      store.set('assistants', [...list(), assistant])
      return assistant
    },
    update(id: string, input: AssistantInput): Assistant {
      const existing = get(id)
      if (!existing) throw new Error(`Assistant not found: ${id}`)

      const updated: Assistant = { ...existing, ...input, updatedAt: new Date().toISOString() }
      store.set(
        'assistants',
        list().map((a) => (a.id === id ? updated : a))
      )
      return updated
    },
    delete(id: string): void {
      store.set(
        'assistants',
        list().filter((a) => a.id !== id)
      )
    }
  }
}

export const assistantStore = createAssistantStore()
