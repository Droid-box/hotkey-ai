# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Hotkey AI is an Electron + TypeScript + React desktop app (Windows-only target) for creating custom AI assistants — each with its own name, system prompt, provider, model, and global keyboard shortcut — summoned via global hotkeys into a lightweight always-on-top overlay chat window. Providers are OpenAI and Anthropic. Development happens under WSL2 on the user's Windows machine.

## Commands

```bash
npm run dev          # electron-vite dev with HMR (renderer) + main/preload rebuild
npm run build        # electron-vite build -> out/
npm run typecheck    # tsc -b --noEmit (project references — see tsconfig note below)
npm test             # vitest run (all unit tests, headless)
npm run package:win  # build + electron-builder --win (NSIS + portable; needs wine on Linux)
npx electron-builder --win --dir   # package WITHOUT NSIS/wine -> dist/win-unpacked/ (use this on WSL)
```

Run a single test: `npx vitest run tests/unit/accelerator.test.ts` (or `npx vitest -t "<name>"` to filter by test name; drop `run` for watch mode).

`npm run typecheck` uses **TypeScript project references** (`tsc -b`): `tsconfig.json` references `tsconfig.node.json` (main+preload), `tsconfig.web.management.json`, and `tsconfig.web.overlay.json`. There is no separate vitest config — Vitest reads `electron.vite.config.ts`.

## Architecture

**Three-context Electron split**, each a separate Vite build (`electron.vite.config.ts`):
- **main** (`src/main`) — Node/Electron process: windows, tray, global shortcuts, storage, all provider/network calls.
- **preload** (`src/preload`) — two entries (`managementPreload.ts`, `overlayPreload.ts`) exposing a typed `window.hotkeyAI` bridge via `contextBridge`. `sandbox: false` (see comments in the window managers — the sandboxed loader can't resolve the shared `ipcChannels` chunk), but `contextIsolation: true` + `nodeIntegration: false` remain the real security boundary.
- **renderer** (`src/renderer`) — two React apps: `management/` (the settings window: assistants CRUD, API keys, settings) and `overlay/` (the summoned chat window).

**IPC contract is centralized and typed.** `src/preload/shared/ipcChannels.ts` is the single source of channel-name constants; `src/preload/shared/types.ts` defines the payload types AND the `ManagementBridge`/`OverlayBridge` shapes. To add an IPC call you touch four files in lockstep: channel constant → main handler (`src/main/ipc/*Ipc.ts`, registered in `src/main/index.ts`) → preload bridge method → shared type. Every main-process handler validates its payload with a **zod** schema (`src/main/store/schema.ts`) before touching storage or the network.

**Single reusable overlay window.** `overlayWindow.ts` creates ONE hidden `BrowserWindow` at startup and reconfigures it per-assistant on each hotkey press (never one window per assistant). It's `transparent + frameless + alwaysOnTop + skipTaskbar`. Bounds are composed from a fixed bottom edge + renderer-measured content height + a transient open-slide offset; the window grows upward from the bottom-center of the cursor's display. Size/opacity presets are read from the settings store on each fresh summon. Dismiss on blur (unless pinned), Escape, or close.

**Per-assistant chat state lives in main**, not the renderer: `conversationCache` is an in-memory `Map<assistantId, ChatMessage[]>` (cleared on restart). **The system prompt never leaves the main process** — `OverlayConfigurePayload` deliberately omits it; it's only used when calling the provider. Chat streams main→renderer via `chat:stream-chunk/end/error` pushes; `chat:abort` cancels via `AbortController`.

**Provider abstraction.** `providers/types.ts` defines `AIProvider` (`sendMessage` streaming, `validateApiKey`, `listModels`); `registry.ts` maps `ProviderId → instance`. Adding a provider = one new file implementing `AIProvider` + one registry entry + extend the `ProviderId` union in `shared/types.ts` + the provider list in the management UI.

**Global shortcuts.** `shortcutManager.ts` re-registers everything on every change (no diffing — only a handful of assistants). `index.ts` re-syncs from the assistant store on startup and after every create/update/delete, and re-asserts registrations on `powerMonitor` resume/unlock (Windows drops them across sleep/lock). Cleanup happens **only** on `will-quit` — this is a tray-resident app; `window-all-closed` intentionally does NOT quit. Pure accelerator validation/normalization/duplicate/reserved-combo logic is in `src/preload/shared/accelerator.ts` (fully unit-tested); OS registration failure surfaces as "may be in use by another application."

**Storage** (all `electron-store` JSON in `userData`): `assistants.json`, `secrets.json`, `settings.json`, `window-state.json`. API keys are encrypted with Electron `safeStorage` (Windows DPAPI); the renderer only ever sees `hasKey` + a masked preview, never plaintext. On a keyring-less Linux dev box, keys fall back to an obfuscation-free `insecure-plain:` prefix (never on Windows).

## Critical: WSLg cannot test native behaviors

The dev environment is WSL2/WSLg. These require a **real Windows** build to verify and cannot be tested under WSLg: global hotkey capture from other apps, always-on-top/focus-stealing, native window maximize/drag/double-click, `safeStorage`/DPAPI, transparency/`setOpacity` (a no-op on Linux), and multi-monitor DPI. Platform-specific branches guard this — e.g. `windowControlsIpc.ts` uses a **manual** maximize/resize path on Linux (`process.platform === 'linux'`) because WSLg mis-places frameless windows and renders resize-grab margins as visible bands; the overlay uses software rendering (`disableHardwareAcceleration`) on Linux.

**Established Windows test loop:** `npm run build && npx electron-builder --win --dir`, then copy `dist/win-unpacked/*` to `C:\Users\Jorelle Castillo\HotkeyAI-test\` (stop any running `Hotkey AI.exe` first) for the user to test.

**Headless verification under WSLg** (for renderer/IPC/store logic — not native behavior): launch dev with debuggers exposed and drive via Chrome DevTools Protocol:
```bash
setsid env -u ELECTRON_RUN_AS_NODE npx electron-vite dev -- --remote-debugging-port=9222 --inspect=9229 &
```
Then `curl http://localhost:9222/json` for renderer targets and `http://localhost:9229/json/list` for the main process, and evaluate expressions over the websocket. In dev, `globalThis.__hotkeyDebug.openAssistantOverlay(id)` (main process) simulates a hotkey press. **Gotcha:** `ELECTRON_RUN_AS_NODE=1` sometimes leaks into the shell — Electron then runs as plain Node and the app fails to launch with a module-loader error; always `env -u ELECTRON_RUN_AS_NODE` (or unset it). Also beware `pkill -f electron-vite` self-matching the shell command when killing dev processes.
