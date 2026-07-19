# Hotkey AI

Summon custom AI assistants from anywhere on your desktop with a global keyboard shortcut. Each assistant has its own name, system prompt, provider, model, and hotkey — press it and a lightweight, always-on-top chat overlay appears over whatever you're doing.

Windows desktop app, built with Electron + TypeScript + React.

## Features

- **Per-assistant global hotkeys** → an always-on-top overlay chat, summoned from any app
- **OpenAI and Anthropic** providers; pick any model
- **Streaming responses** with markdown, syntax-highlighted code blocks, and copy buttons
- **Per-assistant options**: system prompt, reset-chat-on-close, prefill-with-clipboard
- **Persistent history** — conversations survive restarts (or auto-clear per assistant)
- **Built-in Test Chat** in the assistant editor for side-by-side prompt tuning
- **Light / Dark / System** theme, overlay size + transparency, silent launch-at-startup
- **Automatic updates** via GitHub Releases
- **API keys encrypted at rest** with Windows credential storage (DPAPI); the renderer never sees plaintext

## Install (Windows)

1. Download the latest **`Hotkey AI Setup x.y.z.exe`** from [Releases](https://github.com/Droid-box/hotkey-ai/releases).
2. Run it. The app isn't code-signed yet, so Windows SmartScreen may warn — click **More info → Run anyway**.
3. Follow the installer (pick an install folder if you like). Desktop and Start Menu shortcuts are created.
4. Launch Hotkey AI — it lives in the **system tray**. Open it from the tray icon, add an API key, and create your first assistant.

The app keeps itself up to date automatically; you can also check manually in **Settings → Version**.

## Uninstall

- **Settings → Apps → Installed apps → Hotkey AI → Uninstall**, or the "Uninstall Hotkey AI" entry in the Start Menu.
- Your assistants, keys, and settings live under `%APPDATA%` and are **kept** after uninstall. Delete that folder (look for `Hotkey AI` / `hotkey-ai`) for a full wipe.

## Usage

1. Tray icon → **Open Hotkey AI**.
2. **API keys** tab → add an OpenAI and/or Anthropic key.
3. **Assistants** tab → **Create**: name, system prompt, provider, model, and a global shortcut.
4. Press the shortcut anywhere → the overlay appears. Enter to send, Shift+Enter for a newline, Esc to dismiss, pin to keep it open.

## Development

Requires Node 22+. Development happens under WSL2; native behaviors (global hotkeys, transparency, DPAPI) require a real Windows build to verify. See [CLAUDE.md](CLAUDE.md) for architecture.

```bash
npm install
npm run dev        # electron-vite dev with HMR
npm run typecheck
npm test
npm run build
```

## Releasing

Releases build on a GitHub Actions **Windows runner** (no local wine needed) and publish to GitHub Releases.

```bash
npm version patch          # bump package.json + create tag (e.g. v1.0.1)
git push --follow-tags     # triggers .github/workflows/release.yml
```

The workflow creates a **draft** release with the installer, portable build, and update manifest (`latest.yml`). Review it on GitHub and click **Publish release** to ship the update to every installed app.

## License

Proprietary — all rights reserved. The source is publicly viewable for reference, but reuse, modification, and redistribution are not permitted. See [LICENSE](LICENSE).
