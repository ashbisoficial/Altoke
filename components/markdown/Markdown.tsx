import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renderiza Markdown de forma segura. react-markdown no interpreta HTML
 * crudo (se muestra como texto) y bloquea enlaces con esquemas peligrosos
 * como javascript:, así que no hace falta un saneador aparte.
 */
export function Markdown({ children, className = "" }: { children: string; className?: string }) {
  return (
    <div className={`md-content break-words text-sm leading-relaxed ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children: text }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">
              {text}
            </a>
          ),
          img: ({ src, alt }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={alt ?? ""} loading="lazy" className="my-2 max-h-96 rounded-lg border border-border" />
          ),
          p: ({ children: text }) => <p className="mb-2 last:mb-0">{text}</p>,
          ul: ({ children: text }) => <ul className="mb-2 ml-5 list-disc">{text}</ul>,
          ol: ({ children: text }) => <ol className="mb-2 ml-5 list-decimal">{text}</ol>,
          code: ({ children: text }) => <code className="rounded bg-bg px-1 py-0.5 font-mono text-xs">{text}</code>,
          pre: ({ children: text }) => <pre className="mb-2 overflow-x-auto rounded-lg bg-bg p-3 text-xs">{text}</pre>,
          blockquote: ({ children: text }) => <blockquote className="mb-2 border-l-2 border-border pl-3 text-ink/70">{text}</blockquote>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
