import type { MouseEvent } from 'react'

export function TitleBar() {
  const { windowControls } = window.hotkeyAI

  // Double-clicking the draggable title bar toggles maximize/restore, like
  // standard Windows title bars. Ignore double-clicks on the control buttons.
  function onDoubleClick(e: MouseEvent<HTMLElement>): void {
    if ((e.target as HTMLElement).closest('.titlebar-controls')) return
    windowControls.toggleMaximize()
  }

  return (
    <header className="titlebar" onDoubleClick={onDoubleClick}>
      <span className="titlebar-title">Hotkey AI</span>
      <div className="titlebar-controls">
        <button
          className="tb-btn"
          onClick={windowControls.minimize}
          aria-label="Minimize window"
          title="Minimize"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <line x1="0" y1="5" x2="10" y2="5" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>
        <button
          className="tb-btn"
          onClick={windowControls.toggleMaximize}
          aria-label="Maximize or restore window"
          title="Maximize"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>
        <button
          className="tb-btn tb-close"
          onClick={windowControls.close}
          aria-label="Close window"
          title="Close"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" strokeWidth="1" />
            <line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>
      </div>
    </header>
  )
}
