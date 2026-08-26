import { useEffect, useMemo, useRef, useState } from 'react';
import { FONT_CHOICES, fontStack } from '../formatting/rails';
import { CheckIcon, SearchIcon } from '../ui/icons';
import {
  CATEGORIES,
  catalogNow,
  loadCatalog,
  searchFonts,
  type CatalogFont,
} from './fontCatalog';
import { ensureFont } from './loadFont';

/** How many catalogue rows to draw at once.
 *
 *  Small on purpose. Every visible row loads its own typeface so it can be shown
 *  in its own face, which is the entire point of a font picker and also the
 *  expensive part. Twenty-four is about two screenfuls of scroll and two dozen
 *  subset requests; a list of nineteen hundred would be neither usable nor kind
 *  to the network. Search is what reaches the rest. */
const LIMIT = 24;

/** Renders its label in the face it names, loading that face on mount.
 *
 *  Choosing a typeface from a list of names set in a different typeface is not
 *  choosing a typeface. */
function FontRow({
  family,
  tag,
  active,
  onPick,
}: {
  family: string;
  tag?: string;
  active: boolean;
  onPick: () => void;
}) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let live = true;
    void ensureFont(family).then(() => live && setLoaded(true));
    return () => {
      live = false;
    };
  }, [family]);

  const stack = fontStack(family);

  return (
    <button
      onClick={onPick}
      // No `title`: the row already says the name, in the face it names, so a
      // native tooltip only adds a black box floating over the list you are
      // trying to read down.
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        height: 36,
        padding: '0 8px',
        border: 'none',
        cursor: 'pointer',
        background: active ? 'var(--emerald-50)' : 'transparent',
        color: active ? 'var(--emerald-700)' : 'var(--neutral-700)',
        borderRadius: 'var(--radius-sharp)',
        textAlign: 'left',
        // Nothing shifts when the face lands: the row keeps its height and the
        // label just sharpens from the fallback into the real thing.
        transition: 'background-color .12s',
      }}
    >
      <span
        aria-hidden
        style={{
          fontFamily: stack,
          fontSize: 15,
          fontWeight: 600,
          flexShrink: 0,
          width: 22,
          opacity: loaded ? 1 : 0.35,
          transition: 'opacity .2s',
        }}
      >
        Ag
      </span>
      <span
        style={{
          fontFamily: stack,
          fontSize: 12.5,
          flex: 1,
          minWidth: 0,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {family}
      </span>
      {tag && (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--neutral-600)',
            flexShrink: 0,
          }}
        >
          {tag}
        </span>
      )}
      {active && (
        <span style={{ flexShrink: 0, display: 'flex', color: 'var(--emerald-600)' }}>
          <CheckIcon size={13} />
        </span>
      )}
    </button>
  );
}

const LABEL: React.CSSProperties = {
  display: 'block',
  padding: '8px 8px 4px',
  fontFamily: 'var(--font-mono)',
  fontSize: 8.5,
  fontWeight: 700,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--neutral-600)',
};

/**
 * Typeface chooser: the three house faces, and the rest of Google Fonts behind a
 * search field.
 *
 * The old menu offered exactly three, which was defensible while three was all
 * the app could export without substituting. It is not a limit worth keeping now
 * that any Google Font can be fetched for the canvas, named for Google Slides and
 * embedded into the .pptx.
 *
 * The house three stay pinned at the top rather than being dissolved into the
 * catalogue. `rails.ts` exists to make the on-brand choice the fast one, and a
 * search field that starts empty and lists Roboto first would quietly make going
 * off-brand the default. Reaching the other nineteen hundred takes typing, which
 * is the deliberate effort that principle asks for.
 */
export function FontPicker({
  current,
  hasOverride,
  onPick,
  onReset,
  close,
}: {
  /** The face in effect on the selection, house or catalogue. */
  current?: string;
  /** Whether the slot carries a typeface override, so Reset can be offered. */
  hasOverride: boolean;
  onPick: (family: string) => void;
  onReset: () => void;
  close: () => void;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [catalogState, setCatalogState] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    catalogNow() ? 'ready' : 'idle'
  );
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetched when the menu opens rather than on app start: it is ~380KB of data
  // that a session which never changes a typeface has no reason to download.
  useEffect(() => {
    if (catalogNow()) return;
    setCatalogState('loading');
    loadCatalog().then(
      () => setCatalogState('ready'),
      () => setCatalogState('error')
    );
  }, []);

  useEffect(() => {
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, []);

  const catalog = catalogState === 'ready' ? catalogNow() : null;

  const searching = query.trim().length > 0 || category !== null;

  const results: CatalogFont[] = useMemo(() => {
    if (!catalog) return [];
    const found = searchFonts(catalog.fonts, query, category, LIMIT + FONT_CHOICES.length);
    // Filtered out only while the House section is on screen above, where they
    // would otherwise appear twice and read as duplicates rather than sections.
    // While searching that section is hidden, so they have to stay in - dropping
    // them here is what made typing "DM Sans" return nothing at all.
    if (searching) return found.slice(0, LIMIT);
    const houseFaces = new Set(FONT_CHOICES.map((f) => f.face));
    return found.filter((f) => !houseFaces.has(f.family)).slice(0, LIMIT);
  }, [catalog, query, category, searching]);

  const chip = (on: boolean): React.CSSProperties => ({
    height: 22,
    padding: '0 7px',
    fontFamily: 'var(--font-mono)',
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    border: `1px solid ${on ? 'var(--emerald-500)' : 'var(--neutral-200)'}`,
    background: on ? 'var(--emerald-50)' : '#fff',
    color: on ? 'var(--emerald-700)' : 'var(--neutral-500)',
    cursor: 'pointer',
    borderRadius: 'var(--radius-sharp)',
    whiteSpace: 'nowrap',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          height: 32,
          padding: '0 8px',
          border: '1px solid var(--neutral-200)',
          borderRadius: 'var(--radius-sharp)',
        }}
      >
        <span style={{ display: 'flex', color: 'var(--neutral-600)', flexShrink: 0 }}>
          <SearchIcon size={13} />
        </span>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search fonts"
          spellCheck={false}
          style={{
            flex: 1,
            minWidth: 0,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: 12.5,
            color: 'var(--neutral-900)',
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <button onClick={() => setCategory(null)} style={chip(category === null)}>
          All
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategory(category === c.id ? null : c.id)}
            style={chip(category === c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div
        // Marks this as a scrolling region so the menu neither closes on the
        // wheel nor blocks the scrollbar thumb.
        data-menu-scroll
        style={{ maxHeight: 296, overflowY: 'auto', overscrollBehavior: 'contain', margin: '0 -4px', padding: '0 4px' }}
      >
        {/* House faces, always, whatever the search says. They are three rows and
            they are the answer most of the time. */}
        {!searching && <span style={LABEL}>House</span>}
        {!searching &&
          FONT_CHOICES.map((f) => (
            <FontRow
              key={f.face}
              family={f.face}
              tag={f.label}
              active={current === f.face}
              onPick={() => {
                onPick(f.face);
                close();
              }}
            />
          ))}

        <span style={LABEL}>{searching ? 'Google Fonts' : 'More from Google Fonts'}</span>

        {catalogState === 'loading' && (
          <span style={{ display: 'block', padding: '10px 8px', fontSize: 11.5, color: 'var(--neutral-600)' }}>
            Loading the catalogue…
          </span>
        )}

        {catalogState === 'error' && (
          <span style={{ display: 'block', padding: '10px 8px', fontSize: 11.5, color: 'var(--neutral-600)', lineHeight: 1.5 }}>
            Could not reach the font catalogue. The house faces above still work,
            and they need no network.
          </span>
        )}

        {catalog && results.length === 0 && (
          <span style={{ display: 'block', padding: '10px 8px', fontSize: 11.5, color: 'var(--neutral-600)' }}>
            Nothing matches “{query}”.
          </span>
        )}

        {results.map((f) => (
          <FontRow
            key={f.family}
            family={f.family}
            active={current === f.family}
            onPick={() => {
              onPick(f.family);
              close();
            }}
          />
        ))}

        {catalog && !searching && results.length >= LIMIT && (
          <span style={{ display: 'block', padding: '6px 8px 2px', fontSize: 10.5, color: 'var(--neutral-600)', lineHeight: 1.5 }}>
            Showing the {LIMIT} most used. Type to search the rest.
          </span>
        )}
      </div>

      {hasOverride && (
        <>
          <div style={{ height: 1, background: 'var(--neutral-200)', margin: '2px 4px' }} />
          <button
            onClick={() => {
              onReset();
              close();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              height: 32,
              padding: '0 8px',
              border: 'none',
              background: 'transparent',
              color: 'var(--neutral-700)',
              fontSize: 12.5,
              cursor: 'pointer',
              borderRadius: 'var(--radius-sharp)',
              textAlign: 'left',
            }}
          >
            Template typeface
          </button>
        </>
      )}
    </div>
  );
}
