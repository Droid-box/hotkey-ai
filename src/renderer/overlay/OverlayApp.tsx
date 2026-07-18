import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ChatMessage, OverlayConfigurePayload } from '../../preload/shared/types'
import { ChatMarkdown } from './ChatMarkdown'

interface DisplayMessage extends ChatMessage {
  error?: boolean
}

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
      <path
        d="M12 17v5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </svg>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy(): void {
    window.hotkeyAI.copyText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      className={`msg-copy ${copied ? 'msg-copy-done' : ''}`}
      onClick={handleCopy}
      aria-label="Copy message"
      title={copied ? 'Copied' : 'Copy message'}
    >
      {copied ? (
        <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true">
          <path
            d="M2.5 7.5 6 11l5.5-7.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true">
          <rect
            x="5"
            y="5"
            width="7.5"
            height="7.5"
            rx="1.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
          />
          <path
            d="M9.5 2.75H3.75c-.55 0-1 .45-1 1V9.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  )
}

function MessageBubble({ message, streaming }: { message: DisplayMessage; streaming: boolean }) {
  const isUser = message.role === 'user'
  return (
    <div className={`msg-row ${isUser ? 'msg-row-user' : ''}`}>
      <div
        className={`msg ${isUser ? 'msg-user' : 'msg-assistant'} ${message.error ? 'msg-error' : ''}`}
      >
        {isUser || message.error ? (
          message.content
        ) : (
          <div className="msg-markdown">
            <ChatMarkdown>{message.content}</ChatMarkdown>
            {streaming && <span className="cursor" />}
          </div>
        )}
      </div>
      {!streaming && !message.error && <CopyButton text={message.content} />}
    </div>
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
  const overlayRef = useRef<HTMLDivElement>(null)
  const pendingOpenAnimRef = useRef(false)

  // Restart the slide-up animation, but only while the window is actually
  // visible. On a fresh open, configure arrives while the window is still
  // hidden; the animation is deferred until the visibilitychange to
  // "visible" so it plays on screen (fixes it not showing on Windows).
  const playOpenAnimation = useCallback(() => {
    if (!pendingOpenAnimRef.current) return
    if (document.visibilityState !== 'visible') return
    const el = overlayRef.current
    if (!el) return
    pendingOpenAnimRef.current = false
    el.classList.remove('overlay-open')
    void el.offsetWidth // reflow so the keyframes restart even if present
    el.classList.add('overlay-open')
  }, [])

  useEffect(() => {
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') playOpenAnimation()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [playOpenAnimation])

  useEffect(() => {
    const unsubscribers = [
      window.hotkeyAI.onConfigure((payload) => {
        setConfigured(true)
        setAssistant(payload.assistant)
        assistantIdRef.current = payload.assistant?.id ?? null
        setMessages(payload.history)
        setStreaming(false)
        setDraft('')
        setPinned(payload.pinned)
        // Focus the input every time the overlay is summoned.
        requestAnimationFrame(() => inputRef.current?.focus())
        // On a fresh open, arm the slide-up animation. It's actually started
        // on the window's visibility transition (playOpenAnimation), because
        // configure arrives while the window is still hidden — starting the
        // animation before the window is composited makes it play invisibly
        // on GPU-accelerated Windows.
        if (payload.justOpened) {
          pendingOpenAnimRef.current = true
          playOpenAnimation()
        }
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
      window.hotkeyAI.onStreamError(({ assistantId, message }) => {
        if (assistantId !== assistantIdRef.current) return
        setStreaming(false)
        setMessages((prev) => [...prev, { role: 'assistant', content: message, error: true }])
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

  // Single line by default; grow with content up to a cap, then scroll.
  const MAX_INPUT_HEIGHT = 140
  useLayoutEffect(() => {
    const ta = inputRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, MAX_INPUT_HEIGHT)}px`
    ta.style.overflowY = ta.scrollHeight > MAX_INPUT_HEIGHT ? 'auto' : 'hidden'
  }, [draft])

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
    <div className="overlay" ref={overlayRef}>
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
            <div className="chat-inputbox">
              <textarea
                ref={inputRef}
                className="chat-input"
                value={draft}
                rows={1}
                placeholder={`Message ${assistant.name}…`}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    send()
                  }
                }}
              />
              {streaming ? (
                <button
                  className="chat-send-icon"
                  onClick={() => assistant && window.hotkeyAI.abort(assistant.id)}
                  aria-label="Stop response"
                  title="Stop"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                    <rect x="1" y="1" width="10" height="10" rx="2" fill="currentColor" />
                  </svg>
                </button>
              ) : (
                <button
                  className="chat-send-icon"
                  onClick={send}
                  disabled={!draft.trim()}
                  aria-label="Send message"
                  title="Send"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
                    <path
                      d="M8 13.5V2.5M8 2.5 3 7.5M8 2.5l5 5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              )}
            </div>
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
  )
}
