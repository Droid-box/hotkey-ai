import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { ApiKeyInfo, ProviderId } from '../../preload/shared/types'

const PROVIDERS: { id: ProviderId; label: string; placeholder: string }[] = [
  { id: 'openai', label: 'OpenAI', placeholder: 'sk-…' },
  { id: 'anthropic', label: 'Anthropic', placeholder: 'sk-ant-…' }
]

const PROVIDER_LABELS: Record<string, string> = Object.fromEntries(
  PROVIDERS.map((p) => [p.id, p.label])
)

function friendlyTestError(raw: string | undefined, providerLabel: string): string {
  if (!raw) return 'The provider rejected this key.'
  if (raw.includes('401') || raw.toLowerCase().includes('authentication')) {
    return `${providerLabel} rejected this key. Double-check it and try again.`
  }
  if (raw.toLowerCase().includes('timeout') || raw.toLowerCase().includes('connection')) {
    return `Couldn't reach ${providerLabel} to verify the key. Check your connection and try again.`
  }
  return raw
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

interface AddKeyModalProps {
  existing: ApiKeyInfo[]
  onSaved: () => void
  onClose: () => void
}

function AddKeyModal({ existing, onSaved, onClose }: AddKeyModalProps) {
  const [provider, setProvider] = useState<ProviderId>('openai')
  const [draft, setDraft] = useState('')
  const [phase, setPhase] = useState<'idle' | 'testing' | 'saving'>('idle')
  const [error, setError] = useState<string | null>(null)

  const replacing = existing.some((k) => k.provider === provider)

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    const key = draft.trim()
    if (!key || phase !== 'idle') return
    setError(null)

    setPhase('testing')
    try {
      const result = await window.hotkeyAI.secrets.testApiKey(provider, key)
      if (!result.ok) {
        setError(friendlyTestError(result.message, PROVIDER_LABELS[provider] ?? provider))
        setPhase('idle')
        return
      }
      setPhase('saving')
      await window.hotkeyAI.secrets.setApiKey(provider, key)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save key')
      setPhase('idle')
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal card" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Add API key</h2>
        <form className="form modal-form" onSubmit={handleSubmit}>
          <div className="field">
            <label className="field-label" htmlFor="key-provider">
              Provider
            </label>
            <select
              id="key-provider"
              className="input"
              value={provider}
              onChange={(e) => setProvider(e.target.value as ProviderId)}
              disabled={phase !== 'idle'}
            >
              {PROVIDERS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            {replacing && (
              <span className="hint">
                A key for {PROVIDER_LABELS[provider]} already exists — saving will replace it.
              </span>
            )}
          </div>

          <div className="field">
            <label className="field-label" htmlFor="key-value">
              API key
            </label>
            <input
              id="key-value"
              className="input"
              type="password"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={PROVIDERS.find((p) => p.id === provider)?.placeholder}
              autoComplete="off"
              autoFocus
              disabled={phase !== 'idle'}
            />
            <span className="hint">
              The key is verified with {PROVIDER_LABELS[provider]} before it&rsquo;s saved.
            </span>
          </div>

          {error && <p className="error-text">{error}</p>}

          <div className="form-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={phase !== 'idle'}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!draft.trim() || phase !== 'idle'}
            >
              {phase === 'testing'
                ? 'Verifying key…'
                : phase === 'saving'
                  ? 'Saving…'
                  : 'Verify & save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyInfo[]>([])
  const [adding, setAdding] = useState(false)

  const refresh = useCallback(() => {
    window.hotkeyAI.secrets.listApiKeys().then(setKeys)
  }, [])

  useEffect(refresh, [refresh])

  async function handleRemove(provider: ProviderId): Promise<void> {
    await window.hotkeyAI.secrets.deleteApiKey(provider)
    refresh()
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">API keys</h1>
          <p className="page-subtitle">
            One key per provider, shared by every assistant using that provider. Keys are
            verified before saving, encrypted with your operating system&rsquo;s credential
            storage, and never shown again.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>
          Add API key
        </button>
      </header>

      {keys.length === 0 ? (
        <div className="card empty">
          <p className="empty-title">No API keys yet</p>
          <p className="empty-hint">
            Add a key for at least one provider so your assistants can respond.
          </p>
        </div>
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Provider</th>
                <th>Key</th>
                <th>Added</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.provider}>
                  <td className="cell-name">{PROVIDER_LABELS[key.provider] ?? key.provider}</td>
                  <td>
                    <span className="badge">{key.masked}</span>
                  </td>
                  <td className="text-muted">{formatDate(key.addedAt)}</td>
                  <td className="cell-actions">
                    <button className="btn btn-danger" onClick={() => handleRemove(key.provider)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adding && (
        <AddKeyModal
          existing={keys}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false)
            refresh()
          }}
        />
      )}
    </div>
  )
}
