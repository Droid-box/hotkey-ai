import { useState } from 'react'
import { ChatMarkdown } from './ChatMarkdown'
import { useCopyText } from './CopyText'

export interface DisplayMessage {
  role: 'user' | 'assistant'
  content: string
  error?: boolean
  errorAction?: 'add-api-key'
}

function CopyButton({ text }: { text: string }) {
  const copyText = useCopyText()
  const [copied, setCopied] = useState(false)

  function handleCopy(): void {
    copyText(text)
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
          <rect x="5" y="5" width="7.5" height="7.5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
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

interface Props {
  message: DisplayMessage
  streaming: boolean
  /** Re-send the last user turn (transient errors). */
  onRetry?: () => void
  /** Open the API keys settings (missing-key errors). */
  onOpenApiKeys?: () => void
}

export function MessageBubble({ message, streaming, onRetry, onOpenApiKeys }: Props) {
  const isUser = message.role === 'user'
  return (
    <div className={`msg-row ${isUser ? 'msg-row-user' : ''}`}>
      <div
        className={`msg ${isUser ? 'msg-user' : 'msg-assistant'} ${message.error ? 'msg-error' : ''}`}
      >
        {message.error ? (
          <>
            <span>{message.content}</span>
            {(onOpenApiKeys || onRetry) && (
              <div className="msg-error-actions">
                {message.errorAction === 'add-api-key' && onOpenApiKeys ? (
                  <button className="msg-error-btn" onClick={onOpenApiKeys}>
                    Open API keys
                  </button>
                ) : onRetry ? (
                  <button className="msg-error-btn" onClick={onRetry}>
                    Retry
                  </button>
                ) : null}
              </div>
            )}
          </>
        ) : isUser ? (
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
