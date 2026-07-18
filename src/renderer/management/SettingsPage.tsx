import { useEffect, useState } from 'react'
import type { ChatWindowSize } from '../../preload/shared/types'

const SIZE_OPTIONS: { value: ChatWindowSize; label: string; hint: string }[] = [
  { value: 'small', label: 'Small', hint: 'Compact — the default size.' },
  { value: 'medium', label: 'Medium', hint: 'Wider and taller.' },
  { value: 'large', label: 'Large', hint: 'The most room for conversation.' }
]

export function SettingsPage() {
  const [size, setSize] = useState<ChatWindowSize | null>(null)

  useEffect(() => {
    window.hotkeyAI.settings.get().then((s) => setSize(s.chatWindowSize))
  }, [])

  function choose(value: ChatWindowSize): void {
    setSize(value)
    void window.hotkeyAI.settings.setChatWindowSize(value)
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
        </div>
      </header>

      <div className="card settings-card">
        <div className="setting-row">
          <div className="setting-label">
            <span className="field-label">Chat window size</span>
            <span className="hint">Applied the next time you open a chat.</span>
          </div>
          <div className="size-options" role="radiogroup" aria-label="Chat window size">
            {SIZE_OPTIONS.map((opt) => {
              const active = size === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={`size-option ${active ? 'size-option-active' : ''}`}
                  onClick={() => choose(opt.value)}
                >
                  <span className="size-option-preview" data-size={opt.value} aria-hidden="true">
                    <span className="size-option-glyph" />
                  </span>
                  <span className="size-option-label">{opt.label}</span>
                  <span className="size-option-hint">{opt.hint}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
