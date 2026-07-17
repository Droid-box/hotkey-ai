import { useEffect, useState, type FormEvent } from 'react'
import type { ApiKeyStatus, ProviderId } from '../../preload/shared/types'

const PROVIDERS: { id: ProviderId; label: string; placeholder: string }[] = [
  { id: 'openai', label: 'OpenAI', placeholder: 'sk-…' },
  { id: 'anthropic', label: 'Anthropic', placeholder: 'sk-ant-…' }
]

function ProviderKeyRow({ id, label, placeholder }: (typeof PROVIDERS)[number]) {
  const [status, setStatus] = useState<ApiKeyStatus>({ hasKey: false, masked: null })
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.hotkeyAI.secrets.getApiKeyStatus(id).then(setStatus)
  }, [id])

  async function handleSave(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (!draft.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      setStatus(await window.hotkeyAI.secrets.setApiKey(id, draft.trim()))
      setDraft('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save key')
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove(): Promise<void> {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await window.hotkeyAI.secrets.deleteApiKey(id)
      setStatus({ hasKey: false, masked: null })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove key')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="key-row">
      <div className="key-row-info">
        <span className="field-label">{label}</span>
        {status.hasKey ? (
          <span className="badge">{status.masked}</span>
        ) : (
          <span className="hint">Not configured</span>
        )}
      </div>
      <form className="key-row-form" onSubmit={handleSave}>
        <input
          className="input"
          type="password"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={status.hasKey ? 'Paste a new key to replace' : placeholder}
          autoComplete="off"
        />
        <button type="submit" className="btn btn-primary" disabled={!draft.trim() || busy}>
          Save
        </button>
        {status.hasKey && (
          <button type="button" className="btn btn-danger" onClick={handleRemove} disabled={busy}>
            Remove
          </button>
        )}
      </form>
      {error && <p className="error-text">{error}</p>}
    </div>
  )
}

export function ApiKeysPage() {
  return (
    <div className="page page-narrow">
      <header className="page-header">
        <div>
          <h1 className="page-title">API keys</h1>
          <p className="page-subtitle">
            One key per provider, shared by every assistant using that provider. Keys are
            encrypted with your operating system&rsquo;s credential storage and never shown
            again once saved.
          </p>
        </div>
      </header>

      <div className="card key-list">
        {PROVIDERS.map((provider) => (
          <ProviderKeyRow key={provider.id} {...provider} />
        ))}
      </div>
    </div>
  )
}
