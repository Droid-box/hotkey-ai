import { useLayoutEffect, useRef, type RefObject } from 'react'

// Single line by default; grow with content up to a cap, then scroll.
const MAX_INPUT_HEIGHT = 140

interface Props {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  onStop: () => void
  streaming: boolean
  placeholder?: string
  disabled?: boolean
  /** Optional external ref so the parent can focus the textarea. */
  inputRef?: RefObject<HTMLTextAreaElement | null>
}

export function Composer({
  value,
  onChange,
  onSubmit,
  onStop,
  streaming,
  placeholder,
  disabled,
  inputRef
}: Props) {
  const localRef = useRef<HTMLTextAreaElement>(null)
  const ref = inputRef ?? localRef

  useLayoutEffect(() => {
    const ta = ref.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, MAX_INPUT_HEIGHT)}px`
    ta.style.overflowY = ta.scrollHeight > MAX_INPUT_HEIGHT ? 'auto' : 'hidden'
  }, [value, ref])

  return (
    <div className="chat-inputbox">
      <textarea
        ref={ref}
        className="chat-input"
        value={value}
        rows={1}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            onSubmit()
          }
        }}
      />
      {streaming ? (
        <button className="chat-send-icon" onClick={onStop} aria-label="Stop response" title="Stop">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <rect x="1" y="1" width="10" height="10" rx="2" fill="currentColor" />
          </svg>
        </button>
      ) : (
        <button
          className="chat-send-icon"
          onClick={onSubmit}
          disabled={disabled || !value.trim()}
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
  )
}
