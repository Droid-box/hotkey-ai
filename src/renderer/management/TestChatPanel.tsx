import { useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '../../preload/shared/types'
import { CopyTextProvider } from '../shared/chat/CopyText'
import { MessageBubble, type DisplayMessage } from '../shared/chat/MessageBubble'
import { Composer } from '../shared/chat/Composer'
import { RefreshIcon } from './icons'

interface Props {
  /** The SAVED assistant's id (null before a new assistant is first saved). */
  assistantId: string | null
  assistantName: string
}

// A throwaway chat for prompt/config testing. It streams through the assistant's
// saved configuration (so edits must be saved to take effect) but keeps its
// conversation entirely in this component — never persisted, never mixed with
// the assistant's real history.
export function TestChatPanel({ assistantId, assistantName }: Props) {
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [draft, setDraft] = useState('')
  const [streaming, setStreaming] = useState(false)
  const idRef = useRef<string | null>(assistantId)
  const scrollRef = useRef<HTMLDivElement>(null)

  idRef.current = assistantId

  // A different assistant (including new -> just-saved) starts a fresh test.
  useEffect(() => {
    setMessages([])
    setStreaming(false)
    setDraft('')
  }, [assistantId])

  useEffect(() => {
    const unsubscribers = [
      window.hotkeyAI.testChat.onStreamChunk(({ assistantId: id, delta }) => {
        if (id !== idRef.current) return
        setMessages((prev) => {
          const last = prev[prev.length - 1]
          if (last?.role === 'assistant' && !last.error) {
            return [...prev.slice(0, -1), { ...last, content: last.content + delta }]
          }
          return [...prev, { role: 'assistant', content: delta }]
        })
      }),
      window.hotkeyAI.testChat.onStreamEnd(({ assistantId: id }) => {
        if (id === idRef.current) setStreaming(false)
      }),
      window.hotkeyAI.testChat.onStreamError(({ assistantId: id, message, action }) => {
        if (id !== idRef.current) return
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
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  function sendText(text: string): void {
    const trimmed = text.trim()
    if (!trimmed || streaming || !assistantId) return
    // Drop any prior error bubbles; send the clean conversation + new turn.
    const next: DisplayMessage[] = [
      ...messages.filter((m) => !m.error),
      { role: 'user', content: trimmed }
    ]
    setMessages(next)
    setDraft('')
    setStreaming(true)
    const history: ChatMessage[] = next.map(({ role, content }) => ({ role, content }))
    window.hotkeyAI.testChat.send(assistantId, history)
  }

  function retry(): void {
    if (!assistantId || streaming) return
    const lastUser = [...messages].reverse().find((m) => m.role === 'user' && !m.error)
    if (!lastUser) return
    const cleaned = messages.filter((m) => !m.error)
    setMessages(cleaned)
    setStreaming(true)
    window.hotkeyAI.testChat.send(
      assistantId,
      cleaned.map(({ role, content }) => ({ role, content }))
    )
  }

  function stop(): void {
    if (assistantId) window.hotkeyAI.testChat.abort(assistantId)
    setStreaming(false)
  }

  function reset(): void {
    if (assistantId) window.hotkeyAI.testChat.abort(assistantId)
    setMessages([])
    setDraft('')
    setStreaming(false)
  }

  const ready = assistantId != null

  return (
    <CopyTextProvider value={window.hotkeyAI.copyText}>
      <div className="test-chat">
        <div className="test-chat-header">
          <span className="test-chat-title">Test chat</span>
          <button
            className="icon-btn"
            onClick={reset}
            disabled={messages.length === 0 && !streaming}
            aria-label="Clear test chat"
            title="Clear test chat"
          >
            <RefreshIcon />
          </button>
        </div>

        {ready && messages.length > 0 ? (
          <div className="test-chat-messages" ref={scrollRef}>
            {messages.map((message, i) => (
              <MessageBubble
                key={i}
                message={message}
                onRetry={retry}
                streaming={streaming && i === messages.length - 1 && message.role === 'assistant'}
              />
            ))}
            {streaming && messages[messages.length - 1]?.role === 'user' && (
              <div className="msg msg-assistant msg-pending">
                <span className="cursor" />
              </div>
            )}
          </div>
        ) : (
          <div className="test-chat-empty">
            {ready
              ? `Send a message to test ${assistantName || 'this assistant'} with its saved settings.`
              : 'Save this assistant to test it here. Changes take effect after you save.'}
          </div>
        )}

        <div className="test-chat-input-area">
          <Composer
            value={draft}
            onChange={setDraft}
            onSubmit={() => sendText(draft)}
            onStop={stop}
            streaming={streaming}
            disabled={!ready}
            placeholder={ready ? `Message ${assistantName || 'assistant'}…` : 'Save to test…'}
          />
        </div>
      </div>
    </CopyTextProvider>
  )
}
