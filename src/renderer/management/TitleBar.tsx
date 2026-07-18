import { useEffect, useRef } from 'react'

export function TitleBar() {
  const { windowControls } = window.hotkeyAI
  const titleBarRef = useRef<HTMLElement>(null)

  // Double-clicking the draggable title bar toggles maximize/restore, like
  // standard Windows title bars. A native listener on the element (rather
  // than React's delegated onDoubleClick) is used because -webkit-app-region:
  // drag regions don't reliably surface synthetic events to React's root.
  // Double-clicks on the control buttons are ignored.
  useEffect(() => {
    const el = titleBarRef.current
    if (!el) return
    const onDoubleClick = (e: globalThis.MouseEvent): void => {
      if ((e.target as HTMLElement).closest('.titlebar-controls')) return
      windowControls.toggleMaximize()
    }
    el.addEventListener('dblclick', onDoubleClick)
    return () => el.removeEventListener('dblclick', onDoubleClick)
  }, [windowControls])

  return (
    <header className="titlebar" ref={titleBarRef}>
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
