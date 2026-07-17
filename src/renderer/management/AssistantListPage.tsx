import type { Assistant } from '../../preload/shared/types'

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
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Assistants</h1>
          <p className="page-subtitle">
            Custom AI assistants, each with its own provider, model, and global shortcut.
          </p>
        </div>
        <button className="btn btn-primary" onClick={onCreate}>
          New assistant
        </button>
      </header>

      {assistants.length === 0 ? (
        <div className="card empty">
          <p className="empty-title">No assistants yet</p>
          <p className="empty-hint">
            Create your first assistant to get started. Global keyboard shortcuts can be
            assigned once shortcut recording lands.
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
                    <button className="btn btn-ghost" onClick={() => onEdit(assistant)}>
                      Edit
                    </button>
                    <button className="btn btn-danger" onClick={() => onDelete(assistant.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
