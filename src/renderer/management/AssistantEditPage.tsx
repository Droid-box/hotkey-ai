import { useEffect, useState, type FormEvent } from 'react'
import type { Assistant, AssistantInput, ProviderId } from '../../preload/shared/types'
import { ShortcutRecorder } from './ShortcutRecorder'

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
  const [shortcut, setShortcut] = useState(assistant?.shortcut ?? '')
  const [prefillClipboard, setPrefillClipboard] = useState(assistant?.prefillClipboard ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [models, setModels] = useState<string[]>([])
  const [modelsError, setModelsError] = useState<string | null>(null)
  const [modelsLoading, setModelsLoading] = useState(false)
  const [manualModel, setManualModel] = useState(false)

  useEffect(() => {
    let stale = false
    setModelsLoading(true)
    setModelsError(null)
    window.hotkeyAI.models.list(provider).then((result) => {
      if (stale) return
      setModels(result.models)
      setModelsError(result.error)
      setModelsLoading(false)
      // No list available -> manual entry is the only way in.
      if (result.models.length === 0) setManualModel(true)
    })
    return () => {
      stale = true
    }
  }, [provider])

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
        shortcut,
        prefillClipboard
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
            onChange={(e) => {
              setProvider(e.target.value as ProviderId)
              setModel('')
              setManualModel(false)
            }}
          >
            {PROVIDER_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <div className="field-label-row">
            <label className="field-label" htmlFor="assistant-model">
              Model
            </label>
            {models.length > 0 && (
              <button
                type="button"
                className="link-button"
                onClick={() => setManualModel(!manualModel)}
              >
                {manualModel ? 'Pick from list' : 'Enter manually'}
              </button>
            )}
          </div>
          {manualModel || models.length === 0 ? (
            <input
              id="assistant-model"
              className="input"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={provider === 'openai' ? 'gpt-5' : 'claude-sonnet-5'}
            />
          ) : (
            <select
              id="assistant-model"
              className="input"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              <option value="" disabled>
                {modelsLoading ? 'Loading models…' : 'Select a model'}
              </option>
              {/* Keep a saved model visible even if the provider no longer lists it. */}
              {model && !models.includes(model) && (
                <option value={model}>{model} (current)</option>
              )}
              {models.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          )}
          {modelsLoading && <span className="hint">Fetching available models…</span>}
          {modelsError && <span className="hint">{modelsError}</span>}
        </div>

        <div className="field">
          <span className="field-label">Keyboard shortcut</span>
          <ShortcutRecorder value={shortcut} onChange={setShortcut} excludeId={assistant?.id} />
          <span className="hint">
            Summons this assistant from anywhere on your desktop, even while other apps are
            focused.
          </span>
        </div>

        <div className="field">
          <div className="field-toggle-row">
            <div className="field-toggle-text">
              <span className="field-label">Prefill with clipboard</span>
              <span className="hint">
                When summoned, the message box shows the last copied text with one keystroke.
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={prefillClipboard}
              aria-label="Prefill with clipboard"
              className={`toggle ${prefillClipboard ? 'toggle-on' : ''}`}
              onClick={() => setPrefillClipboard(!prefillClipboard)}
            >
              <span className="toggle-knob" />
            </button>
          </div>
        </div>

        {error && <p className="error-text">{error}</p>}

        <div className="form-footer">
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!isValid || saving}>
            {saving ? 'Saving…' : assistant ? 'Save' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  )
}
