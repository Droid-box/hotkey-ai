import type { PointerEvent } from 'react'
import type { ResizeEdge } from '../../preload/shared/types'

// Full 8-direction resize. The top handles are thin strips at the very edge
// that sit above the title bar; the window-control buttons keep their centre
// (their glyphs are below the strip), and the titlebar drag region starts
// just beneath it — standard desktop window behaviour.
const EDGES: ResizeEdge[] = [
  'top',
  'bottom',
  'left',
  'right',
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right'
]

const CURSORS: Record<ResizeEdge, string> = {
  top: 'ns-resize',
  bottom: 'ns-resize',
  left: 'ew-resize',
  right: 'ew-resize',
  'top-left': 'nwse-resize',
  'bottom-right': 'nwse-resize',
  'top-right': 'nesw-resize',
  'bottom-left': 'nesw-resize'
}

// Only rendered on Linux (WSLg), where the window is non-resizable at the OS
// level (see managementWindow.ts) — these strips re-implement edge resizing
// through IPC. Pointer capture guarantees we receive pointerup even when the
// cursor leaves the thin handle mid-drag.
export function ResizeHandles() {
  const { resize } = window.hotkeyAI.windowControls

  function makeHandlers(edge: ResizeEdge) {
    const stop = (e: PointerEvent<HTMLDivElement>): void => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
      document.body.classList.remove('resizing')
      document.body.style.cursor = ''
      resize(edge, 'end')
    }

    return {
      onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0) return
        // Stop the drag from starting a text selection / focus change, and
        // lock a consistent resize cursor for the whole gesture even as the
        // pointer leaves the thin handle. The drag itself is tracked by the
        // main process polling the OS cursor — no move events needed.
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        document.body.classList.add('resizing')
        document.body.style.cursor = CURSORS[edge]
        resize(edge, 'start')
      },
      onPointerUp: stop,
      onPointerCancel: stop
    }
  }

  return (
    <>
      {EDGES.map((edge) => (
        <div key={edge} className={`resize-handle resize-${edge}`} {...makeHandlers(edge)} />
      ))}
    </>
  )
}
