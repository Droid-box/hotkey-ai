import { describe, expect, it } from 'vitest'
import {
  findDuplicateAssistant,
  keyboardEventToAccelerator,
  normalizeAccelerator,
  validateAccelerator
} from '../../src/preload/shared/accelerator'

function keyEvent(overrides: Partial<Parameters<typeof keyboardEventToAccelerator>[0]>) {
  return {
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    code: '',
    key: '',
    ...overrides
  }
}

describe('keyboardEventToAccelerator', () => {
  it('builds modifier+letter combos', () => {
    expect(
      keyboardEventToAccelerator(keyEvent({ ctrlKey: true, shiftKey: true, code: 'KeyG', key: 'G' }))
    ).toBe('Ctrl+Shift+G')
  })

  it('maps digits, function keys, arrows, and named keys', () => {
    expect(keyboardEventToAccelerator(keyEvent({ altKey: true, code: 'Digit1', key: '1' }))).toBe('Alt+1')
    expect(keyboardEventToAccelerator(keyEvent({ code: 'F12', key: 'F12' }))).toBe('F12')
    expect(keyboardEventToAccelerator(keyEvent({ ctrlKey: true, code: 'ArrowUp', key: 'ArrowUp' }))).toBe('Ctrl+Up')
    expect(keyboardEventToAccelerator(keyEvent({ ctrlKey: true, code: 'Space', key: ' ' }))).toBe('Ctrl+Space')
    expect(keyboardEventToAccelerator(keyEvent({ metaKey: true, code: 'KeyK', key: 'k' }))).toBe('Super+K')
  })

  it('maps punctuation via the literal character', () => {
    expect(keyboardEventToAccelerator(keyEvent({ ctrlKey: true, code: 'Slash', key: '/' }))).toBe('Ctrl+/')
  })

  it('returns null for bare modifier presses and unsupported keys', () => {
    expect(keyboardEventToAccelerator(keyEvent({ ctrlKey: true, code: 'ControlLeft', key: 'Control' }))).toBeNull()
    expect(keyboardEventToAccelerator(keyEvent({ code: 'MediaPlayPause', key: 'MediaPlayPause' }))).toBeNull()
  })
})

describe('normalizeAccelerator', () => {
  it('orders modifiers canonically', () => {
    expect(normalizeAccelerator('Shift+Ctrl+G')).toBe('Ctrl+Shift+G')
    expect(normalizeAccelerator('Super+Alt+F1')).toBe('Alt+Super+F1')
  })
})

describe('validateAccelerator', () => {
  it('accepts strong-modifier combos and bare function keys', () => {
    expect(validateAccelerator('Ctrl+Shift+G').ok).toBe(true)
    expect(validateAccelerator('Alt+Space').ok).toBe(true)
    expect(validateAccelerator('F9').ok).toBe(true)
  })

  it('rejects shift-only and bare keys', () => {
    expect(validateAccelerator('Shift+A').ok).toBe(false)
    expect(validateAccelerator('A').ok).toBe(false)
  })

  it('rejects reserved system combos', () => {
    expect(validateAccelerator('Ctrl+Alt+Delete').ok).toBe(false)
    expect(validateAccelerator('Alt+F4').ok).toBe(false)
    expect(validateAccelerator('Alt+Tab').ok).toBe(false)
  })

  it('rejects malformed input', () => {
    expect(validateAccelerator('').ok).toBe(false)
    expect(validateAccelerator('Ctrl+').ok).toBe(false)
  })
})

describe('findDuplicateAssistant', () => {
  const assistants = [
    { id: '1', name: 'Grammar', shortcut: 'Ctrl+Shift+G' },
    { id: '2', name: 'Coder', shortcut: 'Ctrl+Shift+C' },
    { id: '3', name: 'NoShortcut', shortcut: '' }
  ]

  it('finds an assistant using the same accelerator (order-insensitive)', () => {
    expect(findDuplicateAssistant('Shift+Ctrl+G', assistants)?.name).toBe('Grammar')
  })

  it('ignores the excluded assistant and empty shortcuts', () => {
    expect(findDuplicateAssistant('Ctrl+Shift+G', assistants, '1')).toBeUndefined()
    expect(findDuplicateAssistant('', assistants)).toBeUndefined()
  })

  it('returns undefined when free', () => {
    expect(findDuplicateAssistant('Ctrl+Shift+X', assistants)).toBeUndefined()
  })
})
