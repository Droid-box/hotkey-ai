import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { OverlayConfigurePayload } from '../../preload/shared/types'
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

export function OverlayApp() {
  const [assistant, setAssistant] = useState<OverlayConfigurePayload['assistant']>(null)
  const [configured, setConfigured] = useState(false)
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [draft, setDraft] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [pinned, setPinned] = useState(false)

  const assistantIdRef = useRef<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const inputAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const unsubscribers = [
      window.hotkeyAI.onConfigure((payload) => {
        setConfigured(true)
        setAssistant(payload.assistant)
        assistantIdRef.current = payload.assistant?.id ?? null
        setMessages(payload.history)
        setStreaming(false)
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
      })
    ]
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        if (assistantIdRef.current) window.hotkeyAI.abort(assistantIdRef.current)
        window.hotkeyAI.close()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  // Fit the window to its content: header + conversation + input. The main
  // process clamps between compact (input-only) and max height, so the
  // overlay opens small and grows with the conversation.
  useLayoutEffect(() => {
    const headerHeight = headerRef.current?.offsetHeight ?? 0
    const inputHeight = inputAreaRef.current?.offsetHeight ?? 0
    const messagesHeight = messages.length > 0 ? (scrollRef.current?.scrollHeight ?? 0) : 0
    const noAssistantHeight = assistant ? 0 : 80
    window.hotkeyAI.resizeContent(headerHeight + messagesHeight + inputHeight + noAssistantHeight + 2)
  }, [assistant, messages, draft, streaming])

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
    // Re-send the most recent user turn. Main dropped it from history when the
    // request failed, so sendMessage re-appends it; we just clear the error
    // bubble(s) and keep the user's message on screen.
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
    setStreaming(false)
    inputRef.current?.focus()
  }

  function togglePin(): void {
    const next = !pinned
    setPinned(next)
    window.hotkeyAI.setPinned(next)
  }

  return (
    <CopyTextProvider value={window.hotkeyAI.copyText}>
      <div className="overlay">
        <header className="overlay-header" ref={headerRef}>
          <span className="overlay-title">{assistant?.name ?? 'Hotkey AI'}</span>
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
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                  <path
                    d="M7 1.5v11M1.5 7h11"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
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
            {messages.length > 0 && (
              <div className="chat-messages" ref={scrollRef}>
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
    </CopyTextProvider>
  )
}
