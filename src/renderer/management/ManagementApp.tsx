import { useCallback, useEffect, useState } from 'react'
import type { Assistant, AssistantInput } from '../../preload/shared/types'
import { AssistantListPage } from './AssistantListPage'
import { AssistantEditPage } from './AssistantEditPage'
import { ApiKeysPage } from './ApiKeysPage'
import { TitleBar } from './TitleBar'
import { ResizeHandles } from './ResizeHandles'

type View = { type: 'list' } | { type: 'edit'; assistant?: Assistant } | { type: 'keys' }

export function ManagementApp() {
  const [assistants, setAssistants] = useState<Assistant[]>([])
  const [view, setView] = useState<View>({ type: 'list' })

  const refresh = useCallback(() => {
    window.hotkeyAI.assistants.list().then(setAssistants)
  }, [])

  useEffect(() => {
    refresh()
    return window.hotkeyAI.assistants.onUpdated(refresh)
  }, [refresh])

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
      {window.hotkeyAI.platform === 'linux' && <ResizeHandles />}
      <div className="app-body">
        <nav className="tabs">
          <button
            className={`tab ${view.type !== 'keys' ? 'tab-active' : ''}`}
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
        </nav>

        {view.type === 'keys' ? (
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
            onCreate={() => setView({ type: 'edit' })}
            onEdit={(assistant) => setView({ type: 'edit', assistant })}
            onDelete={handleDelete}
          />
        )}
      </div>
    </div>
  )
}
