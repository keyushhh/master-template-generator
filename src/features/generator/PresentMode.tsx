import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SlideStage } from './PresentationCanvas';
import { FitStage } from './FitStage';
import type { DocumentNode } from '../business-record/parser/ast';
import type { Deck, SlideInstance } from '../deck/types';
import { WOZKU_THEME, type DeckTheme } from '../theme/deckTheme';
import {
  ChevronBackIcon,
  ChevronForwardIcon,
  CloseIcon,
  DocumentTextIcon,
  EyeOffIcon,
  LayersIcon,
  PlayIcon,
  RefreshIcon,
} from '../ui/icons';

interface PresentModeProps {
  open: boolean;
  onClose: () => void;
  deck: Deck;
  ast: DocumentNode | null;
  /** Slide index (within visible slides) to open on. */
  startIndex?: number;
  /** The deck's resolved theme. */
  theme?: DeckTheme;
}

/** Milliseconds of no pointer movement before the chrome fades away. */
const IDLE_MS = 2600;

const CHROME_BG = 'rgba(20,20,22,0.92)';
const CHROME_BORDER = '1px solid rgba(255,255,255,0.10)';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** mm:ss, rolling over to h:mm:ss only once it has to. */
function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** A control in the presenter bar. Dark-on-dark, so it never competes with the slide. */
function BarButton({
  label,
  onClick,
  disabled,
  active,
  wide,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  /** Lets a control carry a text label beside its icon. */
  wide?: boolean;
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={active}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        height: 32,
        width: wide ? undefined : 32,
        padding: wide ? '0 11px' : 0,
        border: 'none',
        borderRadius: 'var(--radius-sharp)',
        background: active
          ? 'var(--emerald-600)'
          : !disabled && hover
            ? 'rgba(255,255,255,0.13)'
            : 'transparent',
        color: disabled ? 'rgba(255,255,255,0.25)' : active ? '#fff' : 'rgba(255,255,255,0.82)',
        fontFamily: 'var(--font-sans)',
        fontSize: 12,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background .15s, color .15s',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

/**
 * Fullscreen presenter.
 *
 * Three deliberate departures from the version this replaces:
 *
 *  - **No chrome on the slide.** The counter used to be absolutely positioned
 *    over the bottom of the slide in translucent white, which is unreadable on
 *    a white slide - i.e. on most of them. Everything that is UI now lives in a
 *    bar *outside* the slide's box, on its own opaque dark ground, so contrast
 *    is a property of the chrome rather than a gamble on the deck's palette.
 *  - **A presenter view.** Speaker notes in a drawer aren't presenting. The
 *    presenter layout shows the current slide, what's coming next, a timer and
 *    the notes at a readable size at once - the thing you actually want on your
 *    own screen while the room sees the slide.
 *  - **Clicking anywhere advances.** The old left half went *backwards*, with no
 *    cursor or hint saying so, so a click meant to advance silently rewound the
 *    deck. Back is the arrow keys and the on-screen arrow, per Keynote.
 */
export function PresentMode({ open, onClose, deck, ast, startIndex = 0, theme = WOZKU_THEME }: PresentModeProps) {
  const visible = useMemo(() => deck.slides.filter((s) => !s.hidden), [deck.slides]);
  const total = visible.length;

  const [index, setIndex] = useState(startIndex);
  const [scale, setScale] = useState(0.5);
  /** Presenter layout: current + next + notes + timer, for the presenter's own
   *  screen. Audience layout (the default) is the slide and nothing else. */
  const [presenter, setPresenter] = useState(false);
  /** Blackout, the `B` key. Standard in every presenter tool: kill the screen so
   *  the room looks at you instead of the slide. */
  const [blank, setBlank] = useState(false);
  /** The jump-to-slide grid. */
  const [picker, setPicker] = useState(false);
  /** Chrome visibility, driven by pointer idleness. */
  const [idle, setIdle] = useState(false);

  const [elapsed, setElapsed] = useState(0);
  const [timerRunning, setTimerRunning] = useState(true);

  const next = useCallback(() => setIndex((i) => Math.min(i + 1, total - 1)), [total]);
  const prev = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), []);

  // Reset to the requested slide, and restart the clock, each time we open.
  useEffect(() => {
    if (!open) return;
    setIndex(Math.min(startIndex, Math.max(0, total - 1)));
    setElapsed(0);
    setTimerRunning(true);
    setBlank(false);
    setPicker(false);
  }, [open, startIndex, total]);

  // Fit the 1920x1080 slide to whatever room the layout leaves it. The presenter
  // layout hands the slide a column rather than the window, so the two cases
  // can't share one factor.
  useEffect(() => {
    if (!open) return;
    const fit = () => {
      const availableW = window.innerWidth * (presenter ? 0.62 : 0.94);
      const availableH = window.innerHeight * (presenter ? 0.7 : 0.86);
      setScale(Math.min(availableW / 1920, availableH / 1080));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [open, presenter]);

  // Elapsed timer. Counts wall-clock seconds while running; pausing leaves the
  // reading where it was rather than resetting it.
  useEffect(() => {
    if (!open || !timerRunning) return;
    const id = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [open, timerRunning]);

  // Auto-hide the chrome. The bar is what makes the deck readable, so it comes
  // back on the first hint of a pointer and only leaves once you've stopped.
  const idleTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!open) return;
    const wake = () => {
      setIdle(false);
      window.clearTimeout(idleTimer.current);
      idleTimer.current = window.setTimeout(() => setIdle(true), IDLE_MS);
    };
    wake();
    window.addEventListener('mousemove', wake);
    window.addEventListener('mousedown', wake);
    window.addEventListener('keydown', wake);
    return () => {
      window.clearTimeout(idleTimer.current);
      window.removeEventListener('mousemove', wake);
      window.removeEventListener('mousedown', wake);
      window.removeEventListener('keydown', wake);
    };
  }, [open]);

  // Keyboard. Escape unwinds one layer at a time - picker, then blackout, then
  // the whole overlay - so it can't drop you out of a presentation you only
  // meant to close a panel in.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          if (picker) setPicker(false);
          else if (blank) setBlank(false);
          else onClose();
          return;
        case 'ArrowRight':
        case 'ArrowDown':
        case ' ':
        case 'PageDown':
          e.preventDefault();
          next();
          return;
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          e.preventDefault();
          prev();
          return;
        case 'Home':
          e.preventDefault();
          setIndex(0);
          return;
        case 'End':
          e.preventDefault();
          setIndex(Math.max(0, total - 1));
          return;
      }
      switch (e.key.toLowerCase()) {
        // 'P' for presenter view, 'B' for blackout, 'G' for the slide grid -
        // the conventions Keynote and PowerPoint already taught everyone.
        case 'p':
          e.preventDefault();
          setPresenter((v) => !v);
          return;
        case 'b':
          e.preventDefault();
          setBlank((v) => !v);
          return;
        case 'g':
          e.preventDefault();
          setPicker((v) => !v);
          return;
        case 't':
          e.preventDefault();
          setTimerRunning((v) => !v);
          return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, next, prev, total, picker, blank]);

  if (!open || total === 0) return null;

  const slide = visible[Math.min(index, total - 1)];
  const upcoming: SlideInstance | null = index + 1 < total ? visible[index + 1] : null;
  const atStart = index === 0;
  const atEnd = index === total - 1;
  // The picker is a surface of its own; hiding the bar under it would strand the
  // user with no way back out but the keyboard.
  const chromeVisible = !idle || picker;

  const slideBox = (
    <div style={{ position: 'relative', boxShadow: '0 30px 80px rgba(0,0,0,0.55)', flexShrink: 0 }}>
      <SlideStage
        slide={slide}
        ast={ast}
        num={pad(index + 1)}
        scale={scale}
        logoUrl={deck.logoUrl}
        theme={theme}
      />
      {/* Click-to-advance. One direction only - see the component note. */}
      <div
        onClick={next}
        style={{ position: 'absolute', inset: 0, cursor: atEnd ? 'default' : 'pointer' }}
        aria-hidden
      />
    </div>
  );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: '#0a0a0b',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* ── Stage ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 28,
          padding: presenter ? '28px 32px 12px' : 0,
        }}
      >
        {blank ? (
          <button
            onClick={() => setBlank(false)}
            style={{
              position: 'absolute',
              inset: 0,
              border: 'none',
              background: '#000',
              color: 'rgba(255,255,255,0.30)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              zIndex: 5,
            }}
          >
            Screen blanked. Click or press B to resume
          </button>
        ) : presenter ? (
          <>
            {/* Presenter: the slide the room sees, at the size the presenter
                needs, with everything they need beside it. */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.34)',
                }}
              >
                On screen · {slide.title}
              </span>
              {slideBox}
            </div>

            <aside
              style={{
                width: 'min(30vw, 420px)',
                alignSelf: 'stretch',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                minWidth: 0,
                paddingBottom: 4,
              }}
            >
              {/* Timer, big enough to read at a glance from a lectern. */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '10px 12px',
                  background: 'rgba(255,255,255,0.055)',
                  border: CHROME_BORDER,
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 26,
                    fontWeight: 700,
                    letterSpacing: '0.02em',
                    color: timerRunning ? '#fff' : 'rgba(255,255,255,0.45)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {formatElapsed(elapsed)}
                </span>
                <span style={{ display: 'flex', gap: 2 }}>
                  <BarButton
                    label={timerRunning ? 'Pause timer (T)' : 'Start timer (T)'}
                    onClick={() => setTimerRunning((v) => !v)}
                  >
                    {timerRunning ? <span style={{ fontSize: 13, fontWeight: 700 }}>❙❙</span> : <PlayIcon size={14} />}
                  </BarButton>
                  <BarButton label="Reset timer" onClick={() => { setElapsed(0); setTimerRunning(true); }}>
                    <RefreshIcon size={14} />
                  </BarButton>
                </span>
              </div>

              {/* Next slide. The single most useful thing on a presenter screen
                  and the thing the old drawer-only layout had no room for. */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.34)',
                  }}
                >
                  {upcoming ? `Up next · ${upcoming.title}` : 'Up next'}
                </span>
                {upcoming ? (
                  <div style={{ border: CHROME_BORDER }}>
                    <FitStage slide={upcoming} ast={ast} num={pad(index + 2)} logoUrl={deck.logoUrl} theme={theme} />
                  </div>
                ) : (
                  <div
                    style={{
                      aspectRatio: '16 / 9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px dashed rgba(255,255,255,0.14)',
                      color: 'rgba(255,255,255,0.3)',
                      fontSize: 12,
                    }}
                  >
                    End of deck
                  </div>
                )}
              </div>

              {/* Notes, always on in presenter view - it is the presenter's
                  screen, so there is nothing to hide them from. */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flex: 1, minHeight: 0 }}>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.34)',
                  }}
                >
                  Notes
                </span>
                <div
                  style={{
                    flex: 1,
                    minHeight: 90,
                    overflowY: 'auto',
                    padding: '11px 13px',
                    background: 'rgba(255,255,255,0.055)',
                    border: CHROME_BORDER,
                    color: 'rgba(255,255,255,0.88)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: 15,
                    lineHeight: 1.62,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {slide.notes?.trim() || (
                    <span style={{ color: 'rgba(255,255,255,0.3)' }}>No notes on this slide.</span>
                  )}
                </div>
              </div>
            </aside>
          </>
        ) : (
          slideBox
        )}

        {/* Audience-layout back/forward arrows, off the slide and only while the
            chrome is awake. */}
        {!presenter && !blank && (
          <>
            <div
              style={{
                position: 'absolute',
                left: 20,
                top: '50%',
                transform: 'translateY(-50%)',
                opacity: chromeVisible ? 1 : 0,
                transition: 'opacity .25s',
                pointerEvents: chromeVisible ? 'auto' : 'none',
              }}
            >
              <BarButton label="Previous slide (←)" onClick={prev} disabled={atStart}>
                <ChevronBackIcon size={20} />
              </BarButton>
            </div>
            <div
              style={{
                position: 'absolute',
                right: 20,
                top: '50%',
                transform: 'translateY(-50%)',
                opacity: chromeVisible ? 1 : 0,
                transition: 'opacity .25s',
                pointerEvents: chromeVisible ? 'auto' : 'none',
              }}
            >
              <BarButton label="Next slide (→)" onClick={next} disabled={atEnd}>
                <ChevronForwardIcon size={20} />
              </BarButton>
            </div>
          </>
        )}
      </div>

      {/* ── Jump-to-slide grid ────────────────────────────────────────────── */}
      {picker && (
        <div
          onClick={() => setPicker(false)}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 8,
            background: 'rgba(6,6,8,0.94)',
            overflowY: 'auto',
            padding: '36px 36px 96px',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.38)',
              marginBottom: 18,
            }}
          >
            Jump to slide · {total} slides
          </div>
          <div
            style={{
              display: 'grid',
              gap: 18,
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            }}
          >
            {visible.map((s, i) => (
              <button
                key={s.instanceId}
                onClick={(e) => {
                  e.stopPropagation();
                  setIndex(i);
                  setPicker(false);
                }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 7,
                  padding: 0,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span
                  style={{
                    display: 'block',
                    border: i === index ? '2px solid var(--emerald-500)' : '1px solid rgba(255,255,255,0.14)',
                  }}
                >
                  <FitStage slide={s} ast={ast} num={pad(i + 1)} logoUrl={deck.logoUrl} theme={theme} />
                </span>
                <span
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'baseline',
                    fontSize: 11.5,
                    color: i === index ? 'var(--emerald-400)' : 'rgba(255,255,255,0.55)',
                  }}
                >
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{pad(i + 1)}</span>
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {s.title}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Presenter bar ─────────────────────────────────────────────────────
          Outside the slide's box, on its own opaque ground. This is the fix for
          the unreadable counter: contrast no longer depends on the deck. */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          flexShrink: 0,
          opacity: chromeVisible ? 1 : 0,
          transform: chromeVisible ? 'none' : 'translateY(12px)',
          transition: 'opacity .25s, transform .25s',
          pointerEvents: chromeVisible ? 'auto' : 'none',
        }}
      >
        {/* Progress. A deck-length scrubber, and the only chrome allowed to be
            a hairline - it carries no text to be illegible. */}
        <div style={{ height: 2, background: 'rgba(255,255,255,0.10)' }}>
          <div
            style={{
              height: '100%',
              width: `${((index + 1) / total) * 100}%`,
              background: 'var(--emerald-500)',
              transition: 'width .22s cubic-bezier(.4,0,.2,1)',
            }}
          />
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            height: 52,
            padding: '0 14px',
            background: CHROME_BG,
            backdropFilter: 'blur(12px)',
            borderTop: CHROME_BORDER,
          }}
        >
          {/* Position + title. Opaque ground, tabular figures, real contrast. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <button
              onClick={() => setPicker((v) => !v)}
              title="Jump to slide (G)"
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 5,
                padding: '4px 9px',
                border: CHROME_BORDER,
                borderRadius: 'var(--radius-sharp)',
                background: 'rgba(255,255,255,0.07)',
                color: '#fff',
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '0.04em',
                cursor: 'pointer',
              }}
            >
              {pad(index + 1)}
              <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>/ {pad(total)}</span>
            </button>
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 12.5,
                color: 'rgba(255,255,255,0.62)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                minWidth: 0,
              }}
            >
              {slide.title}
            </span>
          </div>

          {/* Timer, mirrored into the audience-layout bar so it's reachable
              without switching views. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            {!presenter && (
              <>
                <button
                  onClick={() => setTimerRunning((v) => !v)}
                  title={timerRunning ? 'Pause timer (T)' : 'Start timer (T)'}
                  style={{
                    padding: '4px 8px',
                    border: 'none',
                    background: 'transparent',
                    color: timerRunning ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.4)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12.5,
                    fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums',
                    cursor: 'pointer',
                  }}
                >
                  {formatElapsed(elapsed)}
                </button>
                <span style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.12)', margin: '0 5px' }} />
              </>
            )}

            <BarButton label="Jump to slide (G)" onClick={() => setPicker((v) => !v)} active={picker}>
              <LayersIcon size={16} />
            </BarButton>
            <BarButton label="Blank the screen (B)" onClick={() => setBlank(true)}>
              <EyeOffIcon size={16} />
            </BarButton>
            <BarButton
              label="Presenter view (P)"
              onClick={() => setPresenter((v) => !v)}
              active={presenter}
              wide
            >
              <DocumentTextIcon size={15} />
              Presenter
            </BarButton>

            <span style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.12)', margin: '0 5px' }} />

            <BarButton label="Previous slide (←)" onClick={prev} disabled={atStart}>
              <ChevronBackIcon size={17} />
            </BarButton>
            <BarButton label="Next slide (→)" onClick={next} disabled={atEnd}>
              <ChevronForwardIcon size={17} />
            </BarButton>

            <span style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.12)', margin: '0 5px' }} />

            <BarButton label="Exit present mode (Esc)" onClick={onClose}>
              <CloseIcon size={16} />
            </BarButton>
          </div>
        </div>
      </div>
    </div>
  );
}
