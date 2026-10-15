interface CodeBlockProps {
  /** Pre-formatted text, e.g. indented JSON. */
  children: string;
  /** Accessible name for the block (what the text is). */
  label?: string;
}

/**
 * Read-only monospace block for machine text — an audit entry's before/after
 * JSON, a request id. Wraps long lines and scrolls instead of widening the
 * drawer it sits in.
 */
export function CodeBlock({ children, label }: CodeBlockProps) {
  return (
    <pre
      aria-label={label}
      className="text-caption text-text-body bg-grey-200 border-border-soft m-0 max-h-80 overflow-auto rounded-sm border px-3 py-2.5 font-mono break-words whitespace-pre-wrap"
    >
      {children}
    </pre>
  );
}
