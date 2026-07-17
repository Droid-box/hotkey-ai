// Pure accelerator helpers shared by main (validation, conflict checks) and
// renderer (ShortcutRecorder key capture). No Electron imports — fully
// unit-testable.

export interface AcceleratorKeyEvent {
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
  metaKey: boolean
  code: string
  key: string
}

export interface AcceleratorCheck {
  ok: boolean
  reason: string | null
}

const MODIFIER_CODES = new Set([
  'ControlLeft',
  'ControlRight',
  'AltLeft',
  'AltRight',
  'ShiftLeft',
  'ShiftRight',
  'MetaLeft',
  'MetaRight'
])

// Combos Windows reserves or that users almost certainly don't mean.
const RESERVED = new Set([
  'Ctrl+Alt+Delete',
  'Ctrl+Shift+Esc',
  'Alt+Tab',
  'Alt+Shift+Tab',
  'Alt+F4',
  'Super+L',
  'Super+D'
])

const FUNCTION_KEY = /^F([1-9]|1[0-9]|2[0-4])$/

function keyFromCode(code: string, key: string): string | null {
  if (MODIFIER_CODES.has(code)) return null
  if (/^Key[A-Z]$/.test(code)) return code.slice(3)
  if (/^Digit[0-9]$/.test(code)) return code.slice(5)
  if (FUNCTION_KEY.test(code)) return code
  switch (code) {
    case 'Space':
      return 'Space'
    case 'ArrowUp':
      return 'Up'
    case 'ArrowDown':
      return 'Down'
    case 'ArrowLeft':
      return 'Left'
    case 'ArrowRight':
      return 'Right'
    case 'Home':
    case 'End':
    case 'PageUp':
    case 'PageDown':
    case 'Insert':
    case 'Delete':
    case 'Backspace':
    case 'Tab':
    case 'Enter':
      return code
    case 'Escape':
      return 'Esc'
    case 'Backquote':
    case 'Minus':
    case 'Equal':
    case 'BracketLeft':
    case 'BracketRight':
    case 'Backslash':
    case 'Semicolon':
    case 'Quote':
    case 'Comma':
    case 'Period':
    case 'Slash':
      // Punctuation: Electron accepts the literal character.
      return key.length === 1 ? key : null
    default:
      return null
  }
}

/**
 * Builds an Electron accelerator string from a keydown event, or null if the
 * event is a bare modifier / unsupported key.
 */
export function keyboardEventToAccelerator(event: AcceleratorKeyEvent): string | null {
  const key = keyFromCode(event.code, event.key)
  if (!key) return null

  const modifiers: string[] = []
  if (event.ctrlKey) modifiers.push('Ctrl')
  if (event.altKey) modifiers.push('Alt')
  if (event.shiftKey) modifiers.push('Shift')
  if (event.metaKey) modifiers.push('Super')

  return [...modifiers, key].join('+')
}

interface ParsedAccelerator {
  modifiers: string[]
  key: string
}

function parse(accelerator: string): ParsedAccelerator | null {
  const parts = accelerator.split('+')
  if (parts.length === 0 || parts.some((p) => p.length === 0)) return null
  const key = parts[parts.length - 1]
  return { modifiers: parts.slice(0, -1), key }
}

/** Canonical modifier order so string comparisons are stable. */
export function normalizeAccelerator(accelerator: string): string {
  const parsed = parse(accelerator)
  if (!parsed) return accelerator
  const order = ['Ctrl', 'Alt', 'Shift', 'Super']
  const modifiers = order.filter((m) => parsed.modifiers.includes(m))
  return [...modifiers, parsed.key].join('+')
}

/** Validity + policy check; no knowledge of other assistants or the OS. */
export function validateAccelerator(accelerator: string): AcceleratorCheck {
  const parsed = parse(accelerator)
  if (!parsed || !parsed.key) {
    return { ok: false, reason: 'Invalid shortcut.' }
  }

  if (RESERVED.has(normalizeAccelerator(accelerator))) {
    return { ok: false, reason: 'This combination is reserved by the system.' }
  }

  const strongModifiers = parsed.modifiers.filter((m) => m !== 'Shift')
  if (strongModifiers.length === 0 && !FUNCTION_KEY.test(parsed.key)) {
    return {
      ok: false,
      reason: 'Include Ctrl, Alt, or Win (function keys can stand alone).'
    }
  }

  return { ok: true, reason: null }
}

/**
 * Finds another assistant already using this accelerator, if any.
 * `assistants` only needs id/name/shortcut fields.
 */
export function findDuplicateAssistant<T extends { id: string; name: string; shortcut: string }>(
  accelerator: string,
  assistants: T[],
  excludeId?: string
): T | undefined {
  const target = normalizeAccelerator(accelerator)
  return assistants.find(
    (a) => a.id !== excludeId && a.shortcut && normalizeAccelerator(a.shortcut) === target
  )
}
