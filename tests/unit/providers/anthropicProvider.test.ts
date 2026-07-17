import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ChatMessage } from '../../../src/preload/shared/types'

const mockStream = vi.fn()
const mockModelsList = vi.fn()

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { stream: mockStream }
    models = { list: mockModelsList }
  }
}))

const { anthropicProvider } = await import('../../../src/main/providers/anthropicProvider')

interface FakeStreamOptions {
  deltas?: string[]
  failWith?: Error
}

// Mimics the SDK's MessageStream shape: .on('text') subscriptions plus a
// finalMessage() promise that resolves after all deltas are delivered.
function fakeStream({ deltas = [], failWith }: FakeStreamOptions) {
  const handlers: Record<string, (delta: string) => void> = {}
  return {
    on(event: string, handler: (delta: string) => void) {
      handlers[event] = handler
      return this
    },
    async finalMessage() {
      if (failWith) throw failWith
      for (const delta of deltas) handlers['text']?.(delta)
      return { content: [{ type: 'text', text: deltas.join('') }] }
    }
  }
}

const baseParams = {
  apiKey: 'sk-ant-test',
  model: 'claude-sonnet-5',
  systemPrompt: 'Be terse.',
  history: [{ role: 'user', content: 'Hi' }] as ChatMessage[]
}

describe('anthropicProvider', () => {
  beforeEach(() => {
    mockStream.mockReset()
  })

  it('streams tokens in order and reports the full text on done', async () => {
    mockStream.mockReturnValue(fakeStream({ deltas: ['He', 'llo'] }))

    const tokens: string[] = []
    let done = ''
    await anthropicProvider.sendMessage(
      { ...baseParams, signal: new AbortController().signal },
      {
        onToken: (d) => tokens.push(d),
        onDone: (full) => (done = full),
        onError: () => {
          throw new Error('should not error')
        }
      }
    )

    expect(tokens).toEqual(['He', 'llo'])
    expect(done).toBe('Hello')
  })

  it('passes system prompt, model, and history to the SDK', async () => {
    mockStream.mockReturnValue(fakeStream({ deltas: ['ok'] }))
    await anthropicProvider.sendMessage(
      { ...baseParams, signal: new AbortController().signal },
      { onToken: () => {}, onDone: () => {}, onError: () => {} }
    )

    const request = mockStream.mock.calls[0][0]
    expect(request.system).toBe('Be terse.')
    expect(request.model).toBe('claude-sonnet-5')
    expect(request.messages).toEqual([{ role: 'user', content: 'Hi' }])
  })

  it('omits the system field when the prompt is empty', async () => {
    mockStream.mockReturnValue(fakeStream({ deltas: ['ok'] }))
    await anthropicProvider.sendMessage(
      { ...baseParams, systemPrompt: '', signal: new AbortController().signal },
      { onToken: () => {}, onDone: () => {}, onError: () => {} }
    )

    expect('system' in mockStream.mock.calls[0][0]).toBe(false)
  })

  it('reports API failures through onError', async () => {
    mockStream.mockReturnValue(fakeStream({ failWith: new Error('401 authentication_error') }))

    let error: Error | null = null
    await anthropicProvider.sendMessage(
      { ...baseParams, signal: new AbortController().signal },
      { onToken: () => {}, onDone: () => {}, onError: (e) => (error = e) }
    )

    expect(error).not.toBeNull()
    expect(error!.message).toContain('authentication_error')
  })

  it('listModels returns model ids in API order', async () => {
    mockModelsList.mockReturnValue({
      async *[Symbol.asyncIterator]() {
        yield { id: 'claude-opus-4-8' }
        yield { id: 'claude-sonnet-5' }
        yield { id: 'claude-haiku-4-5' }
      }
    })

    await expect(anthropicProvider.listModels('sk-ant-test')).resolves.toEqual([
      'claude-opus-4-8',
      'claude-sonnet-5',
      'claude-haiku-4-5'
    ])
  })

  it('validateApiKey resolves for an accepted key and rejects for a bad one', async () => {
    mockModelsList.mockResolvedValueOnce({ data: [] })
    await expect(anthropicProvider.validateApiKey('sk-ant-good')).resolves.toBeUndefined()

    mockModelsList.mockRejectedValueOnce(new Error('401 authentication_error'))
    await expect(anthropicProvider.validateApiKey('sk-ant-bad')).rejects.toThrow(
      'authentication_error'
    )
  })

  it('treats an abort as done-with-partial, not an error', async () => {
    const controller = new AbortController()
    const handlers: Record<string, (delta: string) => void> = {}
    mockStream.mockReturnValue({
      on(event: string, handler: (delta: string) => void) {
        handlers[event] = handler
        return this
      },
      async finalMessage() {
        handlers['text']?.('partial')
        controller.abort()
        throw Object.assign(new Error('Request was aborted.'), { name: 'APIUserAbortError' })
      }
    })

    let done: string | null = null
    let errored = false
    await anthropicProvider.sendMessage(
      { ...baseParams, signal: controller.signal },
      { onToken: () => {}, onDone: (full) => (done = full), onError: () => (errored = true) }
    )

    expect(errored).toBe(false)
    expect(done).toBe('partial')
  })
})
