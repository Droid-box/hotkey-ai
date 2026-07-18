// Small inline SVG icons for compact icon-only buttons. `currentColor`
// lets each button's CSS drive the color.

export function EditIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M11.5 2.5l2 2L6 12l-2.5.5L4 10l7.5-7.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M2.5 4h11M6 4V2.75h4V4M4 4l.5 9h7l.5-9M6.5 6.5v4M9.5 6.5v4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
