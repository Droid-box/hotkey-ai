import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createAssistantStore, type AssistantStore } from '../../src/main/store/assistantStore'
import type { AssistantInput } from '../../src/preload/shared/types'

const sampleInput: AssistantInput = {
  name: 'Grammar Assistant',
  systemPrompt: 'You are a helpful grammar editor.',
  provider: 'openai',
  model: 'gpt-5',
  shortcut: ''
}

describe('assistantStore', () => {
  let dir: string
  let store: AssistantStore

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'hotkey-ai-test-'))
    store = createAssistantStore({ cwd: dir })
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('starts empty', () => {
    expect(store.list()).toEqual([])
  })

  it('creates an assistant with generated id and timestamps', () => {
    const created = store.create(sampleInput)
    expect(created.id).toBeTruthy()
    expect(created.name).toBe('Grammar Assistant')
    expect(created.createdAt).toBe(created.updatedAt)
    expect(store.list()).toEqual([created])
  })

  it('gets an assistant by id', () => {
    const created = store.create(sampleInput)
    expect(store.get(created.id)).toEqual(created)
    expect(store.get('nonexistent')).toBeUndefined()
  })

  it('updates an assistant and bumps updatedAt without changing id/createdAt', async () => {
    const created = store.create(sampleInput)
    await new Promise((resolve) => setTimeout(resolve, 2))

    const updated = store.update(created.id, { ...sampleInput, name: 'Renamed' })
    expect(updated.id).toBe(created.id)
    expect(updated.createdAt).toBe(created.createdAt)
    expect(updated.name).toBe('Renamed')
    expect(updated.updatedAt).not.toBe(created.updatedAt)
    expect(store.list()).toEqual([updated])
  })

  it('throws when updating a nonexistent assistant', () => {
    expect(() => store.update('missing-id', sampleInput)).toThrow('Assistant not found')
  })

  it('deletes an assistant', () => {
    const created = store.create(sampleInput)
    store.delete(created.id)
    expect(store.list()).toEqual([])
  })

  it('deleting a nonexistent id is a no-op', () => {
    store.create(sampleInput)
    expect(() => store.delete('missing-id')).not.toThrow()
    expect(store.list()).toHaveLength(1)
  })

  it('keeps assistants isolated per store instance/cwd', () => {
    const otherDir = mkdtempSync(join(tmpdir(), 'hotkey-ai-test-'))
    const otherStore = createAssistantStore({ cwd: otherDir })
    try {
      store.create(sampleInput)
      expect(otherStore.list()).toEqual([])
    } finally {
      rmSync(otherDir, { recursive: true, force: true })
    }
  })
})
