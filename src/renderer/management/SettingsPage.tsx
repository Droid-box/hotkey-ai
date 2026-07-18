import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ChatWindowSize } from '../../preload/shared/types'

const SIZE_OPTIONS: { value: ChatWindowSize; label: string }[] = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' }
]

// Transparency is exposed to the user as 0–50% and stored as opacity
// (1 - transparency), floored at 0.5 so the chat stays legible.
const MAX_TRANSPARENCY = 50
const TRANSPARENCY_STEP = 5

const opacityToTransparency = (opacity: number): number => Math.round((1 - opacity) * 100)
const transparencyToOpacity = (pct: number): number => Number((1 - pct / 100).toFixed(2))

export function SettingsPage() {
  const [size, setSize] = useState<ChatWindowSize | null>(null)
  const [opacity, setOpacity] = useState<number | null>(null)

  // Match the transparency control's width to the size segmented control so
  // their left/right edges line up. Measured (not hardcoded) so it stays exact
  // regardless of platform font metrics.
  const segmentedRef = useRef<HTMLDivElement>(null)
  const [controlWidth, setControlWidth] = useState<number | undefined>(undefined)

  useLayoutEffect(() => {
    const measure = (): void => {
      if (segmentedRef.current) setControlWidth(segmentedRef.current.offsetWidth)
    }
    measure()
    // Web fonts can shift the segmented width after first paint; re-measure.
    document.fonts?.ready.then(measure)
  }, [])

  useEffect(() => {
    window.hotkeyAI.settings.get().then((s) => {
      setSize(s.chatWindowSize)
      setOpacity(s.chatWindowOpacity)
    })
  }, [])

  function choose(value: ChatWindowSize): void {
    setSize(value)
    void window.hotkeyAI.settings.setChatWindowSize(value)
  }

  function changeTransparency(pct: number): void {
    const newOpacity = transparencyToOpacity(pct)
    setOpacity(newOpacity)
    void window.hotkeyAI.settings.setChatWindowOpacity(newOpacity)
  }

  const transparency = opacity == null ? 0 : opacityToTransparency(opacity)
  const fillPct = (transparency / MAX_TRANSPARENCY) * 100

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
          <div
            className="segmented"
            role="radiogroup"
            aria-label="Chat window size"
            ref={segmentedRef}
          >
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

        <div className="setting-row">
          <span className="field-label">Chat window transparency</span>
          <div className="slider-control" style={{ width: controlWidth }}>
            <input
              type="range"
              className="slider"
              min={0}
              max={MAX_TRANSPARENCY}
              step={TRANSPARENCY_STEP}
              value={transparency}
              disabled={opacity == null}
              onChange={(e) => changeTransparency(Number(e.target.value))}
              style={{
                background: `linear-gradient(to right, var(--accent) ${fillPct}%, var(--border) ${fillPct}%)`
              }}
              aria-label="Chat window transparency"
            />
            <span className="slider-value">{transparency}%</span>
          </div>
        </div>
      </div>
    </div>
  )
}
