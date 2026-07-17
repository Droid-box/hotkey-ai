import { useState, type FormEvent } from 'react'
import type { Assistant, AssistantInput, ProviderId } from '../../preload/shared/types'

interface Props {
  assistant?: Assistant
  onSave: (input: AssistantInput) => Promise<void>
  onCancel: () => void
}

const PROVIDER_OPTIONS: { id: ProviderId; label: string }[] = [
  { id: 'openai', label: 'OpenAI' },
  { id: 'anthropic', label: 'Anthropic' }
]

export function AssistantEditPage({ assistant, onSave, onCancel }: Props) {
  const [name, setName] = useState(assistant?.name ?? '')
  const [systemPrompt, setSystemPrompt] = useState(assistant?.systemPrompt ?? '')
  const [provider, setProvider] = useState<ProviderId>(assistant?.provider ?? 'openai')
  const [model, setModel] = useState(assistant?.model ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = name.trim().length > 0 && model.trim().length > 0

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (!isValid || saving) return
    setSaving(true)
    setError(null)
    try {
      await onSave({
        name: name.trim(),
        systemPrompt,
        provider,
        model: model.trim(),
        shortcut: assistant?.shortcut ?? ''
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save assistant')
      setSaving(false)
    }
  }

  return (
    <div className="page page-narrow">
      <header className="page-header">
        <div>
          <h1 className="page-title">{assistant ? 'Edit assistant' : 'New assistant'}</h1>
          <p className="page-subtitle">
            {assistant
              ? `Editing “${assistant.name}”`
              : 'Define a specialized assistant and the model that powers it.'}
          </p>
        </div>
      </header>

      <form className="card form" onSubmit={handleSubmit}>
        <div className="field">
          <label className="field-label" htmlFor="assistant-name">
            Name
          </label>
          <input
            id="assistant-name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Grammar Assistant"
            autoFocus
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="assistant-prompt">
            System prompt
          </label>
          <textarea
            id="assistant-prompt"
            className="input"
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="You are a concise grammar and style editor. Improve the text you're given while preserving its meaning and tone…"
          />
          <span className="hint">
            Instructions that shape how this assistant behaves in every conversation.
          </span>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="assistant-provider">
            Provider
          </label>
          <select
            id="assistant-provider"
            className="input"
            value={provider}
            onChange={(e) => setProvider(e.target.value as ProviderId)}
          >
            {PROVIDER_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="assistant-model">
            Model
          </label>
          <input
            id="assistant-model"
            className="input"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={provider === 'openai' ? 'gpt-5' : 'claude-sonnet-5'}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="assistant-shortcut">
            Keyboard shortcut
          </label>
          <input
            id="assistant-shortcut"
            className="input"
            value={assistant?.shortcut ?? ''}
            disabled
            placeholder="Coming soon"
          />
          <span className="hint">Shortcut recording is assigned in a later step.</span>
        </div>

        {error && <p className="error-text">{error}</p>}

        <div className="form-footer">
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!isValid || saving}>
            {saving ? 'Saving…' : assistant ? 'Save changes' : 'Create assistant'}
          </button>
        </div>
      </form>
    </div>
  )
}
