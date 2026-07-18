import { useCallback, useEffect, useState } from 'react'
import type { Assistant, AssistantInput } from '../../preload/shared/types'
import { AssistantListPage } from './AssistantListPage'
import { AssistantEditPage } from './AssistantEditPage'
import { ApiKeysPage } from './ApiKeysPage'
import { SettingsPage } from './SettingsPage'
import { TitleBar } from './TitleBar'
import { ResizeHandles } from './ResizeHandles'

type View =
  | { type: 'list' }
  | { type: 'edit'; assistant?: Assistant }
  | { type: 'keys' }
  | { type: 'settings' }

export function ManagementApp() {
  const [assistants, setAssistants] = useState<Assistant[]>([])
  const [view, setView] = useState<View>({ type: 'list' })
  const [maximized, setMaximized] = useState(false)
  const [shortcutFailures, setShortcutFailures] = useState<string[]>([])

  const refresh = useCallback(() => {
    window.hotkeyAI.assistants.list().then(setAssistants)
  }, [])

  useEffect(() => {
    refresh()
    return window.hotkeyAI.assistants.onUpdated(refresh)
  }, [refresh])

  useEffect(() => window.hotkeyAI.windowControls.onMaximizedChanged(setMaximized), [])

  // Track which assistants' shortcuts the OS refused, so the list can flag them.
  useEffect(() => {
    window.hotkeyAI.shortcuts.getFailures().then(setShortcutFailures)
    return window.hotkeyAI.shortcuts.onFailuresChanged(setShortcutFailures)
  }, [])

  // Main can request a tab switch (e.g. the overlay's "Open API keys" action).
  useEffect(
    () =>
      window.hotkeyAI.onNavigate((tab) => {
        if (tab === 'keys') setView({ type: 'keys' })
        else if (tab === 'settings') setView({ type: 'settings' })
        else setView({ type: 'list' })
      }),
    []
  )

  async function handleSave(input: AssistantInput): Promise<void> {
    if (view.type === 'edit' && view.assistant) {
      await window.hotkeyAI.assistants.update(view.assistant.id, input)
    } else {
      await window.hotkeyAI.assistants.create(input)
    }
    setView({ type: 'list' })
  }

  async function handleDelete(id: string): Promise<void> {
    await window.hotkeyAI.assistants.delete(id)
  }

  return (
    <div className="app-shell">
      <TitleBar />
      {/* No resize handles while maximized — matches native windows, and
          removes the resize cursors along with the drag behavior. */}
      {window.hotkeyAI.platform === 'linux' && !maximized && <ResizeHandles />}
      <div className="app-body">
        <nav className="tabs">
          <button
            className={`tab ${view.type === 'list' || view.type === 'edit' ? 'tab-active' : ''}`}
            onClick={() => setView({ type: 'list' })}
          >
            Assistants
          </button>
          <button
            className={`tab ${view.type === 'keys' ? 'tab-active' : ''}`}
            onClick={() => setView({ type: 'keys' })}
          >
            API keys
          </button>
          <button
            className={`tab ${view.type === 'settings' ? 'tab-active' : ''}`}
            onClick={() => setView({ type: 'settings' })}
          >
            Settings
          </button>
        </nav>

        {view.type === 'settings' ? (
          <SettingsPage />
        ) : view.type === 'keys' ? (
          <ApiKeysPage />
        ) : view.type === 'edit' ? (
          <AssistantEditPage
            assistant={view.assistant}
            onSave={handleSave}
            onCancel={() => setView({ type: 'list' })}
          />
        ) : (
          <AssistantListPage
            assistants={assistants}
            shortcutFailures={shortcutFailures}
            onCreate={() => setView({ type: 'edit' })}
            onEdit={(assistant) => setView({ type: 'edit', assistant })}
            onDelete={handleDelete}
          />
        )}
      </div>
    </div>
  )
}
