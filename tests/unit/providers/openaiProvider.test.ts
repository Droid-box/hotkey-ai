import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ChatMessage } from '../../../src/preload/shared/types'

const mockCreate = vi.fn()

vi.mock('openai', () => ({
  default: class {
    chat = { completions: { create: mockCreate } }
  }
}))

const { openaiProvider } = await import('../../../src/main/providers/openaiProvider')

function chunk(content: string): unknown {
  return { choices: [{ delta: { content } }] }
}

async function* streamOf(...chunks: unknown[]): AsyncGenerator<unknown> {
  for (const c of chunks) yield c
}

const baseParams = {
  apiKey: 'sk-test',
  model: 'gpt-5',
  systemPrompt: 'Be helpful.',
  history: [{ role: 'user', content: 'Hi' }] as ChatMessage[]
}

describe('openaiProvider', () => {
  beforeEach(() => {
    mockCreate.mockReset()
  })

  it('streams tokens in order and reports the full text on done', async () => {
    mockCreate.mockResolvedValue(streamOf(chunk('Hel'), chunk('lo'), { choices: [{ delta: {} }] }))

    const tokens: string[] = []
    let done = ''
    await openaiProvider.sendMessage(
      { ...baseParams, signal: new AbortController().signal },
      {
        onToken: (d) => tokens.push(d),
        onDone: (full) => (done = full),
        onError: () => {
          throw new Error('should not error')
        }
      }
    )

    expect(tokens).toEqual(['Hel', 'lo'])
    expect(done).toBe('Hello')
  })

  it('prepends the system prompt to the message list', async () => {
    mockCreate.mockResolvedValue(streamOf(chunk('ok')))
    await openaiProvider.sendMessage(
      { ...baseParams, signal: new AbortController().signal },
      { onToken: () => {}, onDone: () => {}, onError: () => {} }
    )

    const request = mockCreate.mock.calls[0][0]
    expect(request.messages[0]).toEqual({ role: 'system', content: 'Be helpful.' })
    expect(request.messages[1]).toEqual({ role: 'user', content: 'Hi' })
    expect(request.stream).toBe(true)
  })

  it('omits the system message when the prompt is empty', async () => {
    mockCreate.mockResolvedValue(streamOf(chunk('ok')))
    await openaiProvider.sendMessage(
      { ...baseParams, systemPrompt: '', signal: new AbortController().signal },
      { onToken: () => {}, onDone: () => {}, onError: () => {} }
    )

    expect(mockCreate.mock.calls[0][0].messages[0]).toEqual({ role: 'user', content: 'Hi' })
  })

  it('reports API failures through onError', async () => {
    mockCreate.mockRejectedValue(new Error('401 invalid api key'))

    let error: Error | null = null
    await openaiProvider.sendMessage(
      { ...baseParams, signal: new AbortController().signal },
      { onToken: () => {}, onDone: () => {}, onError: (e) => (error = e) }
    )

    expect(error).not.toBeNull()
    expect(error!.message).toContain('invalid api key')
  })

  it('treats an abort as done-with-partial, not an error', async () => {
    const controller = new AbortController()
    mockCreate.mockResolvedValue(
      (async function* () {
        yield chunk('partial')
        controller.abort()
        throw Object.assign(new Error('Request was aborted.'), { name: 'APIUserAbortError' })
      })()
    )

    let done: string | null = null
    let errored = false
    await openaiProvider.sendMessage(
      { ...baseParams, signal: controller.signal },
      { onToken: () => {}, onDone: (full) => (done = full), onError: () => (errored = true) }
    )

    expect(errored).toBe(false)
    expect(done).toBe('partial')
  })
})
