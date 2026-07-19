import { nativeTheme } from 'electron'
import type { ThemeSetting } from '../../preload/shared/types'

// Opaque window backgrounds matching --bg in shared/theme.css, used for the
// management window's native backgroundColor so it doesn't flash the wrong
// shade during load/resize.
const WINDOW_BG_DARK = '#131316'
const WINDOW_BG_LIGHT = '#f4f4f5'

// Point Electron's theme source at the user's choice. This drives
// prefers-color-scheme in every renderer (which our CSS variables key off),
// and, for 'system', tracks the OS and updates live via nativeTheme 'updated'.
export function applyThemeSource(theme: ThemeSetting): void {
  nativeTheme.themeSource = theme
}

export function windowBackground(): string {
  return nativeTheme.shouldUseDarkColors ? WINDOW_BG_DARK : WINDOW_BG_LIGHT
}
