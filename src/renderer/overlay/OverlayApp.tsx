import { useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import type { ChatMessage, OverlayConfigurePayload } from '../../preload/shared/types'

interface DisplayMessage extends ChatMessage {
  error?: boolean
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
      title="Copy message"
    >
      {copied ? 'Copied' : 'Copy'}
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
            <Markdown>{message.content}</Markdown>
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

  const assistantIdRef = useRef<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const unsubscribers = [
      window.hotkeyAI.onConfigure((payload) => {
        setConfigured(true)
        setAssistant(payload.assistant)
        assistantIdRef.current = payload.assistant?.id ?? null
        setMessages(payload.history)
        setStreaming(false)
        setDraft('')
        // Focus the input every time the overlay is summoned.
        requestAnimationFrame(() => inputRef.current?.focus())
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

  return (
    <div className="overlay">
      <header className="overlay-header">
        <span className="overlay-title">{assistant?.name ?? 'Hotkey AI'}</span>
        {assistant && (
          <span className="overlay-badge">
            {assistant.provider}/{assistant.model}
          </span>
        )}
        <div className="overlay-actions">
          {assistant && messages.length > 0 && (
            <button className="overlay-action" onClick={newChat} title="Start a new chat">
              New chat
            </button>
          )}
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
          <div className="chat-messages" ref={scrollRef}>
            {messages.length === 0 && (
              <p className="chat-empty">
                Ask {assistant.name} anything — the conversation stays available until you
                start a new chat or the app restarts.
              </p>
            )}
            {messages.map((message, i) => (
              <MessageBubble
                key={i}
                message={message}
                streaming={streaming && i === messages.length - 1 && message.role === 'assistant'}
              />
            ))}
            {streaming && messages[messages.length - 1]?.role === 'user' && (
              <div className="msg msg-assistant msg-pending">
                <span className="cursor" />
              </div>
            )}
          </div>

          <div className="chat-input-row">
            <textarea
              ref={inputRef}
              className="chat-input"
              value={draft}
              rows={2}
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
                className="chat-send"
                onClick={() => assistant && window.hotkeyAI.abort(assistant.id)}
                aria-label="Stop response"
              >
                Stop
              </button>
            ) : (
              <button
                className="chat-send"
                onClick={send}
                disabled={!draft.trim()}
                aria-label="Send message"
              >
                Send
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="overlay-body">
          {configured
            ? 'No assistants yet. Open the Hotkey AI window from the tray icon and create one first.'
            : 'Waiting for an assistant to be configured…'}
        </div>
      )}

      <footer className="overlay-footer">
        Press <span className="kbd">Esc</span> to dismiss
        {assistant ? (
          <>
            {' · '}
            <span className="kbd">Enter</span> to send
          </>
        ) : null}
      </footer>
    </div>
  )
}
