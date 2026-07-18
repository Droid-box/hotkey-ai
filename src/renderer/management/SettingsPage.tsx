import { useEffect, useState } from 'react'
import type { ChatWindowSize } from '../../preload/shared/types'

const SIZE_OPTIONS: { value: ChatWindowSize; label: string }[] = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' }
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
          <span className="field-label">Chat window size</span>
          <div className="segmented" role="radiogroup" aria-label="Chat window size">
            {SIZE_OPTIONS.map((opt) => {
              const active = size === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={`segment ${active ? 'segment-active' : ''}`}
                  onClick={() => choose(opt.value)}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
