import type { PointerEvent } from 'react'
import type { ResizeEdge } from '../../preload/shared/types'

const EDGES: ResizeEdge[] = ['left', 'right', 'bottom', 'bottom-left', 'bottom-right']

// Only rendered on Linux (WSLg), where the window is non-resizable at the OS
// level (see managementWindow.ts) — these strips re-implement edge resizing
// through IPC. Pointer capture keeps move events flowing even when the
// cursor leaves the window mid-drag.
export function ResizeHandles() {
  const { resize } = window.hotkeyAI.windowControls

  function makeHandlers(edge: ResizeEdge) {
    return {
      onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        resize(edge, 'start', e.screenX, e.screenY)
      },
      onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
        if (e.buttons !== 1) return
        resize(edge, 'move', e.screenX, e.screenY)
      },
      onPointerUp: (e: PointerEvent<HTMLDivElement>) => {
        e.currentTarget.releasePointerCapture(e.pointerId)
        resize(edge, 'end', e.screenX, e.screenY)
      }
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
