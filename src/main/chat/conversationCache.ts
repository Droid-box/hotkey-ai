import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ChatMessage } from '../../preload/shared/types'
import { userDataPath } from '../lib/paths'

// Per-assistant conversation history. The in-memory Map is the source of truth
// for reads (kept synchronous so summoning the overlay is instant); every
// mutation is written through to a JSONL file so history survives restarts.
const conversations = new Map<string, ChatMessage[]>()

// Cap retained history so files (and the prompt sent to the provider) can't
// grow unbounded; oldest turns are dropped first.
const MAX_MESSAGES = 200

const CONVERSATIONS_DIR = userDataPath('conversations')

// Assistant ids are UUIDs, but guard the filename anyway so a malformed id can
// never escape the conversations directory.
function fileFor(assistantId: string): string {
  const safe = assistantId.replace(/[^a-zA-Z0-9._-]/g, '_')
  return join(CONVERSATIONS_DIR, `${safe}.jsonl`)
}

function persist(assistantId: string): void {
  try {
    const history = conversations.get(assistantId)
    const file = fileFor(assistantId)
    if (!history || history.length === 0) {
      if (existsSync(file)) unlinkSync(file)
      return
    }
    mkdirSync(CONVERSATIONS_DIR, { recursive: true })
    writeFileSync(file, history.map((m) => JSON.stringify(m)).join('\n') + '\n', 'utf8')
  } catch (err) {
    // Persistence is best-effort — never let a disk error break the chat.
    console.warn(`Hotkey AI: failed to persist conversation for ${assistantId}:`, err)
  }
}

function parseFile(file: string): ChatMessage[] {
  const lines = readFileSync(file, 'utf8').split('\n')
  const messages: ChatMessage[] = []
  for (const line of lines) {
    if (!line.trim()) continue
    try {
      const parsed = JSON.parse(line)
      if (
        (parsed?.role === 'user' || parsed?.role === 'assistant') &&
        typeof parsed.content === 'string'
      ) {
        messages.push({ role: parsed.role, content: parsed.content })
      }
    } catch {
      // Skip a corrupt line rather than dropping the whole conversation.
    }
  }
  return messages.slice(-MAX_MESSAGES)
}

export const conversationCache = {
  // Load persisted conversations into memory once at startup. Filenames are
  // the (sanitized) assistant id; orphaned files for deleted assistants are
  // harmless and simply never read.
  init(): void {
    try {
      if (!existsSync(CONVERSATIONS_DIR)) return
      for (const name of readdirSync(CONVERSATIONS_DIR)) {
        if (!name.endsWith('.jsonl')) continue
        const id = name.slice(0, -'.jsonl'.length)
        const messages = parseFile(join(CONVERSATIONS_DIR, name))
        if (messages.length > 0) conversations.set(id, messages)
      }
    } catch (err) {
      console.warn('Hotkey AI: failed to load persisted conversations:', err)
    }
  },

  get(assistantId: string): ChatMessage[] {
    return conversations.get(assistantId) ?? []
  },

  append(assistantId: string, message: ChatMessage): void {
    const history = conversations.get(assistantId) ?? []
    history.push(message)
    if (history.length > MAX_MESSAGES) history.splice(0, history.length - MAX_MESSAGES)
    conversations.set(assistantId, history)
    persist(assistantId)
  },

  removeLast(assistantId: string): void {
    const history = conversations.get(assistantId)
    if (!history) return
    history.pop()
    persist(assistantId)
  },

  clear(assistantId: string): void {
    conversations.delete(assistantId)
    persist(assistantId)
  }
}
