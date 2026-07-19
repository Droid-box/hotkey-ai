import { createContext, useContext, useRef, useState, type ReactNode } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { useCopyText } from './CopyText'

// react-markdown v10 dropped the `inline` prop on the code component, so we
// signal "this <code> is inside a fenced block" via context set by the `pre`
// override. Inline code renders as a chip; block code goes through CodeBlock.
const InsidePre = createContext(false)

// Icon-only copy button, matching the message-level copy control.
function CodeCopyButton({ getText }: { getText: () => string }) {
  const copyText = useCopyText()
  const [copied, setCopied] = useState(false)
  function handleCopy(): void {
    copyText(getText())
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      className={`code-copy ${copied ? 'code-copy-done' : ''}`}
      onClick={handleCopy}
      aria-label={copied ? 'Copied' : 'Copy code'}
      title={copied ? 'Copied' : 'Copy code'}
    >
      {copied ? (
        <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true">
          <path
            d="M2.5 7.5 6 11l5.5-7.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true">
          <rect x="5" y="5" width="7.5" height="7.5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <path
            d="M9.5 2.75H3.75c-.55 0-1 .45-1 1V9.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  )
}

function languageOf(child: ReactNode): string | null {
  // The single child is the highlighted <code> element; pull its language
  // from the `language-xxx` class rehype adds.
  if (child && typeof child === 'object' && 'props' in child) {
    const className = (child.props as { className?: string }).className ?? ''
    const match = /language-([\w-]+)/.exec(className)
    if (match) return match[1]
  }
  return null
}

function CodeBlock({ children }: { children: ReactNode }) {
  const preRef = useRef<HTMLPreElement>(null)
  const lang = languageOf(children)
  return (
    <div className="code-block">
      <div className="code-block-header">
        <span className="code-block-lang">{lang ?? 'code'}</span>
        <CodeCopyButton getText={() => preRef.current?.textContent ?? ''} />
      </div>
      <pre ref={preRef}>
        <InsidePre.Provider value={true}>{children}</InsidePre.Provider>
      </pre>
    </div>
  )
}

function InlineOrBlockCode({
  className,
  children,
  node: _node,
  ...props
}: {
  className?: string
  children?: ReactNode
  node?: unknown
}) {
  const insidePre = useContext(InsidePre)
  if (insidePre) {
    // Inside a fenced block: keep rehype's highlight classes as-is.
    return (
      <code className={className} {...props}>
        {children}
      </code>
    )
  }
  return (
    <code className="inline-code" {...props}>
      {children}
    </code>
  )
}

export function ChatMarkdown({ children }: { children: string }) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
      components={{
        pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
        code: InlineOrBlockCode,
        // Links open in the default browser (handled by each window's
        // will-navigate/window-open handlers); mark them safe.
        a: ({ children, node: _node, ...props }) => (
          <a {...props} target="_blank" rel="noreferrer noopener">
            {children}
          </a>
        )
      }}
    >
      {children}
    </Markdown>
  )
}
