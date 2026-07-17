import { useEffect, useState } from 'react'
import { keyboardEventToAccelerator } from '../../preload/shared/accelerator'

interface Props {
  value: string
  onChange: (accelerator: string) => void
  /** Assistant being edited — its own current shortcut isn't a conflict. */
  excludeId?: string
}

export function ShortcutRecorder({ value, onChange, excludeId }: Props) {
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!recording) return

    let cancelled = false
    function onKeyDown(e: KeyboardEvent): void {
      e.preventDefault()
      e.stopPropagation()

      if (e.key === 'Escape') {
        setRecording(false)
        return
      }

      const accelerator = keyboardEventToAccelerator(e)
      if (!accelerator) return // bare modifier — keep listening

      window.hotkeyAI.shortcuts.checkConflict(accelerator, excludeId).then((result) => {
        if (cancelled) return
        if (result.ok) {
          setError(null)
          onChange(accelerator)
        } else {
          setError(result.reason)
        }
        setRecording(false)
      })
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      cancelled = true
      window.removeEventListener('keydown', onKeyDown, true)
    }
  }, [recording, excludeId, onChange])

  return (
    <div className="shortcut-recorder">
      <div className="shortcut-recorder-row">
        <button
          type="button"
          className={`shortcut-display ${recording ? 'shortcut-recording' : ''}`}
          onClick={() => {
            setError(null)
            setRecording(!recording)
          }}
        >
          {recording ? (
            'Press a key combination… (Esc to cancel)'
          ) : value ? (
            <span className="kbd">{value}</span>
          ) : (
            <span className="shortcut-placeholder">Click to record a shortcut</span>
          )}
        </button>
        {value && !recording && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setError(null)
              onChange('')
            }}
          >
            Clear
          </button>
        )}
      </div>
      {error && <p className="error-text">{error}</p>}
    </div>
  )
}
