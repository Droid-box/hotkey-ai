import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import type { ConversationMeta, OverlayConfigurePayload } from '../../preload/shared/types'
import { CopyTextProvider } from '../shared/chat/CopyText'
import { MessageBubble, type DisplayMessage } from '../shared/chat/MessageBubble'
import { Composer } from '../shared/chat/Composer'

// Classic thumbtack: round head + shaft + needle point. Filled when pinned.
function PinIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={filled ? 1.4 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12 17v5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
    </svg>
  )
}

// Clock = history / log.
function HistoryIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 7.5v5l3.2 1.9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M7 1.5v11M1.5 7h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function TrashIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M2.5 4h11M6 4V2.75h4V4M4 4l.5 9h7l.5-9M6.5 6.5v4M9.5 6.5v4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function XIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M4 4l8 8M12 4l-8 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

// Vertical ellipsis (kebab) — the per-chat actions menu trigger.
function KebabIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="3.2" r="1.35" fill="currentColor" />
      <circle cx="8" cy="8" r="1.35" fill="currentColor" />
      <circle cx="8" cy="12.8" r="1.35" fill="currentColor" />
    </svg>
  )
}

function PencilIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M17 3a2.83 2.83 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// Text-zoom bounds for Ctrl +/-/0 (1 = 100%).
const ZOOM_MIN = 0.8
const ZOOM_MAX = 2.5
const ZOOM_STEP = 0.1
const MENU_WIDTH = 150

function clampZoom(z: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 10) / 10))
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diffMs / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function OverlayApp() {
  const [assistant, setAssistant] = useState<OverlayConfigurePayload['assistant']>(null)
  const [configured, setConfigured] = useState(false)
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [draft, setDraft] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [conversations, setConversations] = useState<ConversationMeta[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [zoom, setZoom] = useState(1)
  // Per-chat actions menu (Rename / Delete). Positioned with fixed coords so it
  // escapes the history list's overflow clipping.
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')

  const assistantIdRef = useRef<string | null>(null)
  const zoomRef = useRef(1)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuTriggerRef = useRef<HTMLElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const messagesListRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const inputAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const unsubscribers = [
      window.hotkeyAI.onConfigure((payload) => {
        setConfigured(true)
        setAssistant(payload.assistant)
        assistantIdRef.current = payload.assistant?.id ?? null
        setMessages(payload.history)
        setConversations(payload.conversations)
        setActiveId(payload.activeConversationId)
        setHistoryOpen(false) // main resets the window width on summon
        setSelectMode(false)
        setSelectedIds(new Set())
        setMenuOpenId(null)
        setRenamingId(null)
        setStreaming(false)
        // Apply the saved app-wide zoom (set in Settings or the other window).
        zoomRef.current = payload.zoom
        window.hotkeyAI.applyZoom(payload.zoom)
        setZoom(payload.zoom)
        // Prefill with the clipboard when the assistant opts in; otherwise
        // start empty.
        setDraft(payload.prefill ?? '')
        setPinned(payload.pinned)
        // Focus the input every time the overlay is summoned (caret at the end
        // of any prefilled text). The slide-up is driven by the main process.
        requestAnimationFrame(() => {
          const ta = inputRef.current
          if (!ta) return
          ta.focus()
          const end = ta.value.length
          ta.setSelectionRange(end, end)
        })
      }),
      window.hotkeyAI.onStreamChunk(({ assistantId, delta }) => {
        if (assistantId !== assistantIdRef.current) return
        setMessages((prev) => {
          const last = prev[prev.length - 1]
          if (last?.role === 'assistant' && !last.error) {
            return [...prev.slice(0, -1), { ...last, content: last.content + delta }]
          }
          return [...prev, { role: 'assistant', content: delta }]
        })
      }),
      window.hotkeyAI.onStreamEnd(({ assistantId }) => {
        if (assistantId !== assistantIdRef.current) return
        setStreaming(false)
        requestAnimationFrame(() => inputRef.current?.focus())
      }),
      window.hotkeyAI.onStreamError(({ assistantId, message, action }) => {
        if (assistantId !== assistantIdRef.current) return
        setStreaming(false)
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: message, error: true, errorAction: action }
        ])
      }),
      // Live sidebar updates: a thread gaining messages, reordering, or getting
      // an AI title.
      window.hotkeyAI.conversations.onChanged(({ assistantId, list }) => {
        if (assistantId !== assistantIdRef.current) return
        setConversations(list.conversations)
        setActiveId(list.activeId)
      })
    ]
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      // Text zoom: Ctrl + '=', Ctrl + '-', Ctrl + '0' to reset.
      if (e.ctrlKey && !e.altKey && !e.metaKey) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault()
          changeZoom(zoomRef.current + ZOOM_STEP)
          return
        }
        if (e.key === '-' || e.key === '_') {
          e.preventDefault()
          changeZoom(zoomRef.current - ZOOM_STEP)
          return
        }
        if (e.key === '0') {
          e.preventDefault()
          changeZoom(1)
          return
        }
      }
      if (e.key === 'Escape') {
        // Unwind the most nested UI first. The rename input handles its own
        // Escape (stopPropagation); here we close an open menu, else the overlay.
        if (menuOpenId) {
          closeMenu()
          return
        }
        if (assistantIdRef.current) window.hotkeyAI.abort(assistantIdRef.current)
        window.hotkeyAI.close()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [menuOpenId])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  // Fit the window to its content (header + conversation + input). While the
  // history sidebar is open the main process pins a fixed browse height and
  // ignores this; on close it reverts to the measured compact size.
  useLayoutEffect(() => {
    // Zoom is already applied to the frame (in changeZoom / on configure) before
    // this runs, so offsetHeight reflects the zoomed, reflowed layout.
    const headerHeight = headerRef.current?.offsetHeight ?? 0
    const inputHeight = inputAreaRef.current?.offsetHeight ?? 0
    // Measure the inner list's NATURAL height, not the scroll container — the
    // container is flex:1 and stretches to a taller window (while history is
    // open), which would otherwise be mistaken for the content height.
    const messagesHeight = messages.length > 0 ? (messagesListRef.current?.offsetHeight ?? 0) : 0
    const noAssistantHeight = assistant ? 0 : 80
    const contentHeight = headerHeight + messagesHeight + inputHeight + noAssistantHeight + 2
    // offsetHeight is in zoom-independent CSS px; the window is sized in device
    // px, so scale by the zoom factor for the window to fit the zoomed content.
    window.hotkeyAI.resizeContent(contentHeight * zoom)
  }, [assistant, messages, draft, streaming, historyOpen, zoom])

  function send(): void {
    const text = draft.trim()
    if (!text || streaming || !assistant) return
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setDraft('')
    setStreaming(true)
    window.hotkeyAI.sendMessage(assistant.id, text)
  }

  function retry(): void {
    if (!assistant || streaming) return
    const lastUser = [...messages].reverse().find((m) => m.role === 'user' && !m.error)
    if (!lastUser) return
    setMessages((prev) => prev.filter((m) => !m.error))
    setStreaming(true)
    window.hotkeyAI.sendMessage(assistant.id, lastUser.content)
  }

  function newChat(): void {
    if (!assistant) return
    window.hotkeyAI.resetChat(assistant.id)
    setMessages([])
    setActiveId(null)
    setStreaming(false)
    exitSelectMode()
    inputRef.current?.focus()
  }

  function togglePin(): void {
    const next = !pinned
    setPinned(next)
    window.hotkeyAI.setPinned(next)
  }

  // Text zoom: apply to this frame immediately (so the resize measures the
  // zoomed layout) and persist app-wide so the other window / next launch match.
  function changeZoom(next: number): void {
    const n = clampZoom(next)
    zoomRef.current = n
    window.hotkeyAI.applyZoom(n)
    window.hotkeyAI.persistZoom(n)
    setZoom(n)
  }

  function toggleHistory(): void {
    const next = !historyOpen
    setHistoryOpen(next)
    window.hotkeyAI.setHistoryOpen(next)
    if (!next) exitSelectMode() // closing history drops any in-progress selection
  }

  function exitSelectMode(): void {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  function enterSelectMode(): void {
    setMenuOpenId(null)
    setRenamingId(null)
    setSelectMode(true)
  }

  function toggleSelected(conversationId: string): void {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(conversationId)) next.delete(conversationId)
      else next.add(conversationId)
      return next
    })
  }

  const allSelected = conversations.length > 0 && selectedIds.size === conversations.length

  function toggleSelectAll(): void {
    setSelectedIds(allSelected ? new Set() : new Set(conversations.map((c) => c.id)))
  }

  async function deleteSelected(): Promise<void> {
    if (!assistant || selectedIds.size === 0) return
    const activeDeleted = activeId != null && selectedIds.has(activeId)
    const list = await window.hotkeyAI.conversations.deleteMany(assistant.id, [...selectedIds])
    setConversations(list.conversations)
    setActiveId(list.activeId)
    if (activeDeleted) setMessages([])
    exitSelectMode()
  }

  async function openThread(conversationId: string): Promise<void> {
    setMenuOpenId(null)
    if (!assistant || conversationId === activeId) return
    window.hotkeyAI.abort(assistant.id)
    const msgs = await window.hotkeyAI.conversations.open(assistant.id, conversationId)
    setMessages(msgs)
    setActiveId(conversationId)
    setStreaming(false)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  async function deleteThread(conversationId: string): Promise<void> {
    if (!assistant) return
    const wasActive = conversationId === activeId
    const list = await window.hotkeyAI.conversations.delete(assistant.id, conversationId)
    setConversations(list.conversations)
    setActiveId(list.activeId)
    if (wasActive) setMessages([])
  }

  // Open the per-chat kebab menu anchored under its button (fixed coords so it
  // isn't clipped by the history list's overflow).
  function openMenu(e: ReactMouseEvent, conversationId: string): void {
    e.stopPropagation()
    const trigger = e.currentTarget as HTMLElement
    const rect = trigger.getBoundingClientRect()
    const left = Math.max(6, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 6))
    // Open below the button, or above it if there isn't room.
    const top = rect.bottom + 84 > window.innerHeight ? rect.top - 84 : rect.bottom + 4
    menuTriggerRef.current = trigger
    setMenuPos({ top, left })
    setMenuOpenId((prev) => (prev === conversationId ? null : conversationId))
  }

  // Close the menu and return focus to the button that opened it (keyboard).
  function closeMenu(): void {
    setMenuOpenId(null)
    menuTriggerRef.current?.focus()
  }

  function startRename(conversationId: string): void {
    const current = conversations.find((c) => c.id === conversationId)
    setRenameDraft(current?.title ?? '')
    setRenamingId(conversationId)
    setMenuOpenId(null)
  }

  async function commitRename(): Promise<void> {
    const id = renamingId
    if (!assistant || !id) return
    const title = renameDraft.trim()
    const current = conversations.find((c) => c.id === id)
    setRenamingId(null)
    if (!title || title === current?.title) return
    const list = await window.hotkeyAI.conversations.rename(assistant.id, id, title)
    setConversations(list.conversations)
    setActiveId(list.activeId)
  }

  // Close the menu on any click/scroll outside it (added a tick after open so
  // the opening click doesn't immediately dismiss it).
  useEffect(() => {
    if (!menuOpenId) return
    // Move focus into the menu so it's operable by keyboard.
    const first = menuRef.current?.querySelector('.history-menu-item')
    if (first instanceof HTMLElement) first.focus()
    function onDocClick(e: MouseEvent): void {
      if (!(e.target as HTMLElement).closest('.history-menu')) setMenuOpenId(null)
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [menuOpenId])

  return (
    <CopyTextProvider value={window.hotkeyAI.copyText}>
      <div className="overlay">
        {historyOpen && assistant && (
          <aside className="history-sidebar">
            <div className="history-header">
              {selectMode ? (
                <>
                  <label className="history-select-all">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      aria-label="Select all chats"
                    />
                    <span>{selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select all'}</span>
                  </label>
                  <div className="history-header-actions">
                    <button
                      className="history-delete-selected"
                      onClick={() => void deleteSelected()}
                      disabled={selectedIds.size === 0}
                      aria-label={`Delete ${selectedIds.size} selected chats`}
                      title="Delete selected"
                    >
                      <TrashIcon size={15} />
                    </button>
                    <button
                      className="overlay-action"
                      onClick={exitSelectMode}
                      aria-label="Cancel selection"
                      title="Cancel"
                    >
                      <XIcon />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span className="history-title">History</span>
                  {conversations.length > 0 && (
                    <button
                      className="overlay-action"
                      onClick={enterSelectMode}
                      aria-label="Select chats to delete"
                      title="Select chats to delete"
                    >
                      <TrashIcon size={15} />
                    </button>
                  )}
                </>
              )}
            </div>
            <div className="history-list">
              {conversations.length === 0 ? (
                <div className="history-empty">No past chats yet.</div>
              ) : (
                conversations.map((c) => {
                  const selected = selectedIds.has(c.id)
                  const renaming = renamingId === c.id
                  return (
                    <div
                      key={c.id}
                      className={`history-item ${
                        selectMode
                          ? selected
                            ? 'history-item-selected'
                            : ''
                          : c.id === activeId
                            ? 'history-item-active'
                            : ''
                      } ${menuOpenId === c.id ? 'history-item-menu-open' : ''}`}
                      onClick={() => {
                        if (renaming) return
                        if (selectMode) toggleSelected(c.id)
                        else void openThread(c.id)
                      }}
                      onKeyDown={(e) => {
                        if (renaming) return
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          if (selectMode) toggleSelected(c.id)
                          else void openThread(c.id)
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      {selectMode && (
                        <input
                          type="checkbox"
                          className="history-item-check"
                          checked={selected}
                          readOnly
                          tabIndex={-1}
                          aria-hidden="true"
                        />
                      )}
                      <div className="history-item-text">
                        {renaming ? (
                          <input
                            className="history-rename-input"
                            value={renameDraft}
                            autoFocus
                            maxLength={100}
                            onChange={(e) => setRenameDraft(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onFocus={(e) => e.currentTarget.select()}
                            onBlur={() => void commitRename()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                void commitRename()
                              } else if (e.key === 'Escape') {
                                e.stopPropagation()
                                setRenamingId(null)
                              }
                            }}
                          />
                        ) : (
                          <>
                            <span className="history-item-title">{c.title}</span>
                            <span className="history-item-time">{relativeTime(c.updatedAt)}</span>
                          </>
                        )}
                      </div>
                      {!selectMode && !renaming && (
                        <button
                          className="history-menu-btn"
                          onClick={(e) => openMenu(e, c.id)}
                          aria-label="Chat options"
                          aria-haspopup="menu"
                          title="Options"
                        >
                          <KebabIcon />
                        </button>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </aside>
        )}

        <div className="overlay-main">
          <header className="overlay-header" ref={headerRef}>
            <span className="overlay-title" title={assistant?.name ?? 'Hotkey AI'}>
              {assistant?.name ?? 'Hotkey AI'}
            </span>
            {assistant && (
              <span className="overlay-badge">
                {assistant.provider}/{assistant.model}
              </span>
            )}
            <div className="overlay-actions">
              {assistant && messages.length > 0 && (
                <button
                  className="overlay-action"
                  onClick={newChat}
                  aria-label="Start a new chat"
                  title="New chat"
                >
                  <PlusIcon />
                </button>
              )}
              {assistant && (
                <button
                  className={`overlay-action ${historyOpen ? 'overlay-action-active' : ''}`}
                  onClick={toggleHistory}
                  aria-label={historyOpen ? 'Hide history' : 'Show history'}
                  aria-pressed={historyOpen}
                  title="History"
                >
                  <HistoryIcon />
                </button>
              )}
              <button
                className={`overlay-action ${pinned ? 'overlay-action-active' : ''}`}
                onClick={togglePin}
                aria-label={pinned ? 'Unpin overlay' : 'Pin overlay'}
                aria-pressed={pinned}
                title={pinned ? 'Unpin (auto-hides on click away)' : 'Pin (stays open on click away)'}
              >
                <PinIcon filled={pinned} />
              </button>
              <button
                className="overlay-close"
                onClick={() => window.hotkeyAI.close()}
                aria-label="Close overlay"
              >
                &times;
              </button>
            </div>
          </header>

          {assistant ? (
            <>
              {(messages.length > 0 || historyOpen) && (
                <div className="chat-messages" ref={scrollRef}>
                  <div className="chat-messages-list" ref={messagesListRef}>
                    {messages.map((message, i) => (
                      <MessageBubble
                        key={i}
                        message={message}
                        onRetry={retry}
                        onOpenApiKeys={() => window.hotkeyAI.openApiKeys()}
                        streaming={
                          streaming && i === messages.length - 1 && message.role === 'assistant'
                        }
                      />
                    ))}
                    {streaming && messages[messages.length - 1]?.role === 'user' && (
                      <div className="msg msg-assistant msg-pending">
                        <span className="cursor" />
                      </div>
                    )}
                  </div>
                  {messages.length === 0 && (
                    <div className="chat-empty-hint">Send a message to start a new chat.</div>
                  )}
                </div>
              )}

              <div className="chat-input-area" ref={inputAreaRef}>
                <Composer
                  value={draft}
                  onChange={setDraft}
                  onSubmit={send}
                  onStop={() => assistant && window.hotkeyAI.abort(assistant.id)}
                  streaming={streaming}
                  placeholder={`Message ${assistant.name}…`}
                  inputRef={inputRef}
                />
              </div>
            </>
          ) : (
            <div className="overlay-body">
              {configured
                ? 'No assistants yet. Open the Hotkey AI window from the tray icon and create one first.'
                : 'Waiting for an assistant to be configured…'}
            </div>
          )}
        </div>

        {menuOpenId && menuPos && (
          <div
            className="history-menu"
            role="menu"
            ref={menuRef}
            onKeyDown={(e) => {
              const items = menuRef.current
                ? [...menuRef.current.querySelectorAll<HTMLElement>('.history-menu-item')]
                : []
              const idx = items.indexOf(document.activeElement as HTMLElement)
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                items[(idx + 1) % items.length]?.focus()
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                items[(idx - 1 + items.length) % items.length]?.focus()
              } else if (e.key === 'Escape') {
                e.stopPropagation()
                closeMenu()
              }
            }}
            style={{ top: menuPos.top, left: menuPos.left, width: MENU_WIDTH }}
          >
            <button
              className="history-menu-item"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation()
                if (menuOpenId) startRename(menuOpenId)
              }}
            >
              <PencilIcon size={14} />
              Rename
            </button>
            <button
              className="history-menu-item history-menu-item-danger"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation()
                if (!menuOpenId) return
                const id = menuOpenId
                setMenuOpenId(null)
                void deleteThread(id)
              }}
            >
              <TrashIcon size={14} />
              Delete
            </button>
          </div>
        )}
      </div>
    </CopyTextProvider>
  )
}
