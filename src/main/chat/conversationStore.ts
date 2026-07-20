import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync
} from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { ChatMessage, ConversationList, ConversationMeta } from '../../preload/shared/types'
import { userDataPath } from '../lib/paths'

// Per-assistant conversation THREADS (multiple, ChatGPT-style history) — a
// rewrite of the old single-conversation cache. On disk:
//   conversations/{assistantId}/index.json      -> { activeId, conversations: meta[] }
//   conversations/{assistantId}/{conversationId}.jsonl -> that thread's messages
// The index (metadata for the sidebar) is held in memory; messages are lazy-
// loaded per thread and cached. A newly-created thread is empty and stays
// entirely in memory until its first message, so blank "New chat" threads
// never touch disk or the history list.

const MAX_MESSAGES = 200 // per thread; oldest dropped
const MAX_THREADS = 50 // per assistant; oldest dropped
const ROOT = userDataPath('conversations')

interface AssistantState {
  activeId: string | null
  metas: Map<string, ConversationMeta>
}

const state = new Map<string, AssistantState>()
const messagesCache = new Map<string, ChatMessage[]>()

// UUIDs are filename-safe, but guard anyway so a malformed id can't escape.
const safe = (id: string): string => id.replace(/[^a-zA-Z0-9._-]/g, '_')
const assistantDir = (assistantId: string): string => join(ROOT, safe(assistantId))
const indexPath = (assistantId: string): string => join(assistantDir(assistantId), 'index.json')
const messagesPath = (assistantId: string, conversationId: string): string =>
  join(assistantDir(assistantId), `${safe(conversationId)}.jsonl`)

function now(): string {
  return new Date().toISOString()
}

function fallbackTitle(messages: ChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === 'user')?.content?.trim()
  if (!firstUser) return 'New chat'
  const oneLine = firstUser.replace(/\s+/g, ' ')
  return oneLine.length > 48 ? `${oneLine.slice(0, 48)}…` : oneLine
}

function stateFor(assistantId: string): AssistantState {
  let s = state.get(assistantId)
  if (!s) {
    s = { activeId: null, metas: new Map() }
    state.set(assistantId, s)
  }
  return s
}

function parseJsonlMessages(file: string): ChatMessage[] {
  const messages: ChatMessage[] = []
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue
    try {
      const p = JSON.parse(line)
      if ((p?.role === 'user' || p?.role === 'assistant') && typeof p.content === 'string') {
        messages.push({ role: p.role, content: p.content })
      }
    } catch {
      // Skip a corrupt line rather than dropping the whole thread.
    }
  }
  return messages.slice(-MAX_MESSAGES)
}

function writeIndex(assistantId: string): void {
  try {
    const s = stateFor(assistantId)
    mkdirSync(assistantDir(assistantId), { recursive: true })
    const list: ConversationList = {
      activeId: s.activeId,
      conversations: [...s.metas.values()]
    }
    writeFileSync(indexPath(assistantId), JSON.stringify(list), 'utf8')
  } catch (err) {
    console.warn(`Hotkey AI: failed to write conversation index for ${assistantId}:`, err)
  }
}

function writeMessages(assistantId: string, conversationId: string): void {
  try {
    const messages = messagesCache.get(conversationId) ?? []
    mkdirSync(assistantDir(assistantId), { recursive: true })
    writeFileSync(
      messagesPath(assistantId, conversationId),
      messages.map((m) => JSON.stringify(m)).join('\n') + '\n',
      'utf8'
    )
  } catch (err) {
    console.warn(`Hotkey AI: failed to write messages for ${conversationId}:`, err)
  }
}

// Convert a pre-history flat file (conversations/{assistantId}.jsonl) into the
// assistant's first thread, so existing conversations aren't lost.
function migrateFlatFile(fileName: string): void {
  try {
    const assistantId = fileName.slice(0, -'.jsonl'.length)
    const flatPath = join(ROOT, fileName)
    const messages = parseJsonlMessages(flatPath)
    if (messages.length > 0) {
      const id = randomUUID()
      const ts = now()
      messagesCache.set(id, messages)
      const s = stateFor(assistantId)
      s.metas.set(id, { id, title: fallbackTitle(messages), createdAt: ts, updatedAt: ts })
      s.activeId = id
      writeMessages(assistantId, id)
      writeIndex(assistantId)
    }
    unlinkSync(flatPath)
  } catch (err) {
    console.warn(`Hotkey AI: failed to migrate ${fileName}:`, err)
  }
}

function loadAssistantIndex(assistantId: string): void {
  try {
    const path = indexPath(assistantId)
    if (!existsSync(path)) return
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as ConversationList
    const s = stateFor(assistantId)
    s.activeId = parsed.activeId ?? null
    for (const meta of parsed.conversations ?? []) {
      if (meta?.id) s.metas.set(meta.id, meta)
    }
  } catch (err) {
    console.warn(`Hotkey AI: failed to load conversation index for ${assistantId}:`, err)
  }
}

function loadMessages(assistantId: string, conversationId: string): ChatMessage[] {
  const cached = messagesCache.get(conversationId)
  if (cached) return cached
  const file = messagesPath(assistantId, conversationId)
  const messages = existsSync(file) ? parseJsonlMessages(file) : []
  messagesCache.set(conversationId, messages)
  return messages
}

// Drop the oldest threads past the cap (by updatedAt).
function pruneThreads(assistantId: string): void {
  const s = stateFor(assistantId)
  if (s.metas.size <= MAX_THREADS) return
  const ordered = [...s.metas.values()].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
  for (const meta of ordered.slice(0, s.metas.size - MAX_THREADS)) {
    s.metas.delete(meta.id)
    messagesCache.delete(meta.id)
    try {
      const f = messagesPath(assistantId, meta.id)
      if (existsSync(f)) unlinkSync(f)
    } catch {
      // best-effort
    }
  }
}

export const conversationStore = {
  init(): void {
    try {
      if (!existsSync(ROOT)) return
      for (const entry of readdirSync(ROOT)) {
        const full = join(ROOT, entry)
        if (entry.endsWith('.jsonl') && statSync(full).isFile()) {
          migrateFlatFile(entry) // old flat format
        } else if (statSync(full).isDirectory()) {
          loadAssistantIndex(entry) // new per-assistant format
        }
      }
    } catch (err) {
      console.warn('Hotkey AI: failed to load conversations:', err)
    }
  },

  // Sidebar payload for an assistant, most-recent thread first.
  list(assistantId: string): ConversationList {
    const s = stateFor(assistantId)
    const conversations = [...s.metas.values()].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt)
    )
    return { activeId: s.activeId, conversations }
  },

  getActiveId(assistantId: string): string | null {
    return stateFor(assistantId).activeId
  },

  // Ensure there's an active thread id (creates an in-memory empty one if not);
  // the empty thread isn't persisted until its first message.
  ensureActive(assistantId: string): string {
    const s = stateFor(assistantId)
    if (!s.activeId) {
      s.activeId = randomUUID()
      writeIndex(assistantId)
    }
    return s.activeId
  },

  getMessages(assistantId: string, conversationId: string): ChatMessage[] {
    return [...loadMessages(assistantId, conversationId)]
  },

  getActiveMessages(assistantId: string): ChatMessage[] {
    const id = stateFor(assistantId).activeId
    return id ? [...loadMessages(assistantId, id)] : []
  },

  // Start a fresh (empty) active thread; the current one stays in history.
  newConversation(assistantId: string): string {
    const s = stateFor(assistantId)
    s.activeId = randomUUID()
    writeIndex(assistantId)
    return s.activeId
  },

  setActive(assistantId: string, conversationId: string): void {
    const s = stateFor(assistantId)
    if (!s.metas.has(conversationId)) return
    s.activeId = conversationId
    writeIndex(assistantId)
  },

  appendToActive(assistantId: string, message: ChatMessage): void {
    const s = stateFor(assistantId)
    const id = this.ensureActive(assistantId)
    const messages = loadMessages(assistantId, id)
    messages.push(message)
    if (messages.length > MAX_MESSAGES) messages.splice(0, messages.length - MAX_MESSAGES)
    messagesCache.set(id, messages)

    const meta = s.metas.get(id)
    const ts = now()
    if (meta) {
      meta.updatedAt = ts
    } else {
      // First message: the thread becomes real and joins the history list.
      s.metas.set(id, { id, title: fallbackTitle(messages), createdAt: ts, updatedAt: ts })
      pruneThreads(assistantId)
    }
    writeMessages(assistantId, id)
    writeIndex(assistantId)
  },

  // Drop the last message of the active thread (used when a request is aborted
  // before any tokens, or fails). If that empties a not-yet-titled thread, it
  // un-persists so no blank thread lingers in history.
  removeLastFromActive(assistantId: string): void {
    const s = stateFor(assistantId)
    const id = s.activeId
    if (!id) return
    const messages = loadMessages(assistantId, id)
    messages.pop()
    messagesCache.set(id, messages)
    if (messages.length === 0) {
      s.metas.delete(id)
      try {
        const f = messagesPath(assistantId, id)
        if (existsSync(f)) unlinkSync(f)
      } catch {
        // best-effort
      }
    }
    writeMessages(assistantId, id)
    writeIndex(assistantId)
  },

  renameConversation(assistantId: string, conversationId: string, title: string): void {
    const meta = stateFor(assistantId).metas.get(conversationId)
    if (!meta) return
    meta.title = title
    writeIndex(assistantId)
  },

  deleteConversation(assistantId: string, conversationId: string): void {
    const s = stateFor(assistantId)
    s.metas.delete(conversationId)
    messagesCache.delete(conversationId)
    try {
      const f = messagesPath(assistantId, conversationId)
      if (existsSync(f)) unlinkSync(f)
    } catch {
      // best-effort
    }
    if (s.activeId === conversationId) s.activeId = null // next summon starts fresh
    writeIndex(assistantId)
  },

  // Reset-chat-on-close / restart: next summon starts a blank thread; the
  // current thread stays in history.
  startFresh(assistantId: string): void {
    stateFor(assistantId).activeId = null
    writeIndex(assistantId)
  },

  // Remove everything for a deleted assistant.
  clearAssistant(assistantId: string): void {
    const s = stateFor(assistantId)
    for (const id of s.metas.keys()) messagesCache.delete(id)
    state.delete(assistantId)
    try {
      const dir = assistantDir(assistantId)
      if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
    } catch (err) {
      console.warn(`Hotkey AI: failed to clear conversations for ${assistantId}:`, err)
    }
  }
}
