/**
 * A light-theme code view for Business Record markdown.
 *
 * Built as a transparent <textarea> sitting exactly on top of a highlighted
 * <pre>, which is the standard way to get syntax colour without giving up a
 * real text input: the browser keeps native editing, selection, IME and undo,
 * and the layer underneath only has to paint. The one hard requirement is that
 * both layers share identical font metrics, padding and wrapping - any drift
 * and the caret stops lining up with the glyphs.
 *
 * Highlighting is deliberately regex-per-line rather than a real Markdown
 * parser. The document this edits has a narrow, known shape (YAML frontmatter,
 * ATX headings, fenced blocks, bullets, bold spans), the output is decorative,
 * and pulling a full parser or a code-editor dependency in to tint a paste box
 * would cost far more than it returns.
 */

import { useEffect, useRef, useState } from 'react';
import { AlertIcon } from '../ui/icons';

interface MarkdownCodeEditorProps {
  value: string;
  onChange?: (next: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  /** Parse/validation failure to surface as an inline pill under the gutter. */
  error?: string | null;
  /** CSS height for the scrolling area. */
  height?: string;
  ariaLabel?: string;
}

/** Shared metrics. Both layers must agree exactly or the caret drifts. */
const FONT = "var(--font-mono)";
const FONT_SIZE = 11.5;
const LINE_HEIGHT = 1.7;
const PAD = 12;
const GUTTER_W = 40;

const C = {
  fence: '#0f766e',
  frontmatter: '#7c3aed',
  key: '#0369a1',
  heading: '#111827',
  bullet: '#059669',
  strong: '#111827',
  plain: '#374151',
  comment: '#9ca3af',
};

/** Escapes text before it is placed into the highlight layer's innerHTML. */
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Inline spans applied inside an already-escaped line. */
function inline(escaped: string): string {
  return escaped
    .replace(/(\*\*[^*]+\*\*)/g, `<span style="color:${C.strong};font-weight:700">$1</span>`)
    .replace(/(`[^`]+`)/g, `<span style="color:${C.fence}">$1</span>`);
}

/**
 * Colours one document. Tracks two pieces of state across lines - whether we
 * are inside the leading YAML frontmatter block and whether we are inside a
 * fenced code block - because both change how a line should be read and
 * neither can be judged from the line alone.
 */
function highlight(src: string): string {
  const lines = src.split('\n');
  let inFrontmatter = false;
  let inFence = false;

  return lines
    .map((line, i) => {
      const e = esc(line);

      if (/^```/.test(line)) {
        inFence = !inFence;
        return `<span style="color:${C.fence}">${e}</span>`;
      }
      if (inFence) return `<span style="color:${C.comment}">${e}</span>`;

      // `---` opens frontmatter only on the very first line; anywhere else it
      // is a horizontal rule, or the closing delimiter.
      if (/^---\s*$/.test(line)) {
        if (i === 0) inFrontmatter = true;
        else if (inFrontmatter) inFrontmatter = false;
        return `<span style="color:${C.frontmatter}">${e}</span>`;
      }
      if (inFrontmatter) {
        const m = line.match(/^(\s*)([A-Za-z0-9_-]+)(\s*:)(.*)$/);
        if (m) {
          return (
            esc(m[1]) +
            `<span style="color:${C.key};font-weight:600">${esc(m[2])}</span>` +
            `<span style="color:${C.comment}">${esc(m[3])}</span>` +
            inline(esc(m[4]))
          );
        }
        return `<span style="color:${C.plain}">${e}</span>`;
      }

      if (/^#{1,6}\s/.test(line)) {
        return `<span style="color:${C.heading};font-weight:700">${e}</span>`;
      }
      const bullet = line.match(/^(\s*)([-*+]|\d+\.)(\s.*)$/);
      if (bullet) {
        return (
          esc(bullet[1]) +
          `<span style="color:${C.bullet};font-weight:700">${esc(bullet[2])}</span>` +
          inline(esc(bullet[3]))
        );
      }
      return `<span style="color:${C.plain}">${inline(e)}</span>`;
    })
    .join('\n');
}

export function MarkdownCodeEditor({
  value,
  onChange,
  readOnly,
  placeholder,
  error,
  height = '34vh',
  ariaLabel = 'Business Record markdown',
}: MarkdownCodeEditorProps) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);

  /** The gutter and the paint layer are separate scroll boxes, so they have to
   *  be driven from the textarea's scroll position or they slide out of sync
   *  the moment the document is taller than the view. */
  const syncScroll = () => {
    const ta = taRef.current;
    if (!ta) return;
    if (preRef.current) {
      preRef.current.scrollTop = ta.scrollTop;
      preRef.current.scrollLeft = ta.scrollLeft;
    }
    if (gutterRef.current) gutterRef.current.scrollTop = ta.scrollTop;
  };

  useEffect(syncScroll, [value]);

  const lineCount = value ? value.split('\n').length : 1;

  const shared: React.CSSProperties = {
    margin: 0,
    fontFamily: FONT,
    fontSize: FONT_SIZE,
    lineHeight: LINE_HEIGHT,
    padding: PAD,
    border: 'none',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
    tabSize: 2,
  };

  return (
    <div>
      <div
        style={{
          position: 'relative',
          display: 'flex',
          height,
          background: 'var(--neutral-50)',
          border: `1px solid ${focused ? 'var(--neutral-400)' : 'var(--neutral-200)'}`,
          borderRadius: 'var(--radius-sharp)',
          overflow: 'hidden',
          transition: 'border-color .12s',
        }}
      >
        {/* Line numbers. CSS counters were tempting, but the lines here wrap -
            a wrapped line must not consume a number, so the gutter is rendered
            from the real line count and simply scrolls in step. */}
        <div
          ref={gutterRef}
          aria-hidden
          style={{
            ...shared,
            width: GUTTER_W,
            flexShrink: 0,
            paddingRight: 8,
            textAlign: 'right',
            color: 'var(--neutral-300)',
            background: 'var(--neutral-100)',
            borderRight: '1px solid var(--neutral-200)',
            overflow: 'hidden',
            userSelect: 'none',
            whiteSpace: 'pre',
          }}
        >
          {Array.from({ length: lineCount }, (_, i) => i + 1).join('\n')}
        </div>

        <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
          <pre
            ref={preRef}
            aria-hidden
            style={{
              ...shared,
              position: 'absolute',
              inset: 0,
              overflow: 'auto',
              pointerEvents: 'none',
              color: C.plain,
            }}
            dangerouslySetInnerHTML={{ __html: highlight(value) + '\n' }}
          />
          <textarea
            ref={taRef}
            aria-label={ariaLabel}
            value={value}
            readOnly={readOnly}
            spellCheck={false}
            placeholder={placeholder}
            onChange={(e) => onChange?.(e.target.value)}
            onScroll={syncScroll}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={{
              ...shared,
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              resize: 'none',
              overflow: 'auto',
              background: 'transparent',
              // The glyphs the user sees are the <pre>'s. Only the caret and
              // the selection come from this layer.
              color: 'transparent',
              caretColor: 'var(--neutral-900)',
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Error pill. Sits under the editor rather than over it so it never
          covers the line it is complaining about. */}
      {error && (
        <div
          role="alert"
          style={{
            marginTop: 8,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            padding: '8px 10px',
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: 'var(--radius-sharp)',
            color: '#991B1B',
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          <AlertIcon size={14} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
