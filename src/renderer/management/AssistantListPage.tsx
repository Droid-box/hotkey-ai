import { useState } from 'react'
import type { Assistant } from '../../preload/shared/types'
import { ConfirmDialog } from './ConfirmDialog'
import { EditIcon, PlusIcon, TrashIcon } from './icons'

interface Props {
  assistants: Assistant[]
  onCreate: () => void
  onEdit: (assistant: Assistant) => void
  onDelete: (id: string) => void
}

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic'
}

export function AssistantListPage({ assistants, onCreate, onEdit, onDelete }: Props) {
  const [pendingDelete, setPendingDelete] = useState<Assistant | null>(null)

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Assistants</h1>
        </div>
        <button className="btn btn-primary" onClick={onCreate}>
          <PlusIcon />
          Create
        </button>
      </header>

      {assistants.length === 0 ? (
        <div className="card empty">
          <p className="empty-title">No assistants yet</p>
          <p className="empty-hint">
            Create your first assistant to get started, then give it a global keyboard
            shortcut to summon it from anywhere.
          </p>
        </div>
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Provider</th>
                <th>Model</th>
                <th>Shortcut</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {assistants.map((assistant) => (
                <tr key={assistant.id}>
                  <td className="cell-name">{assistant.name}</td>
                  <td>
                    <span className="badge">
                      {PROVIDER_LABELS[assistant.provider] ?? assistant.provider}
                    </span>
                  </td>
                  <td className="text-muted">{assistant.model}</td>
                  <td>
                    {assistant.shortcut ? (
                      <span className="kbd">{assistant.shortcut}</span>
                    ) : (
                      <span className="text-muted">Not set</span>
                    )}
                  </td>
                  <td className="cell-actions">
                    <button
                      className="icon-btn"
                      onClick={() => onEdit(assistant)}
                      aria-label={`Edit ${assistant.name}`}
                      title="Edit"
                    >
                      <EditIcon />
                    </button>
                    <button
                      className="icon-btn icon-btn-danger"
                      onClick={() => setPendingDelete(assistant)}
                      aria-label={`Delete ${assistant.name}`}
                      title="Delete"
                    >
                      <TrashIcon />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete assistant"
          message={`Delete “${pendingDelete.name}”? This also releases its keyboard shortcut. This can't be undone.`}
          confirmLabel="Delete"
          destructive
          onConfirm={() => {
            onDelete(pendingDelete.id)
            setPendingDelete(null)
          }}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  )
}
