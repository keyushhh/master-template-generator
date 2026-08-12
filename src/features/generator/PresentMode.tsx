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
  PauseCircleIcon,
  PlayCircleIcon,
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
export function PresentMode({
  open,
  onClose,
  deck,
  ast,
  startIndex = 0,
  theme = WOZKU_THEME,
}: PresentModeProps) {
  const visible = useMemo(() => deck.slides.filter((s) => !s.hidden), [deck.slides]);
  const [index, setIndex] = useState(startIndex);
  const currentSlideId = visible[Math.min(index, Math.max(visible.length - 1, 0))]?.instanceId;
  const [presenter, setPresenter] = useState(false);
  const [blank, setBlank] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);

  const [elapsed, setElapsed] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);

  const [toolMode, setToolMode] = useState<'pointer' | 'laser' | 'pen'>('pointer');
  const [laserPos, setLaserPos] = useState<{ x: number; y: number } | null>(null);
  const [penStrokes, setPenStrokes] = useState<Record<string, Array<{ points: Array<{ x: number; y: number }> }>>>({});
  const [currentStroke, setCurrentStroke] = useState<Array<{ x: number; y: number }> | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const isDrawingRef = useRef(false);
  const strokeRef = useRef<Array<{ x: number; y: number }>>([]);

  /** Point in [0,1] relative to the slide stage, so it stays correct across scale/resize. */
  const relativePoint = useCallback((e: { clientX: number; clientY: number }) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) return { x: 0, y: 0 };
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  }, []);

  const handleStagePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (toolMode !== 'pen') return;
      e.preventDefault();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
      isDrawingRef.current = true;
      const p = relativePoint(e);
      strokeRef.current = [p];
      setCurrentStroke([p]);
    },
    [toolMode, relativePoint]
  );

  const handleStagePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (toolMode === 'laser') {
        setLaserPos(relativePoint(e));
      } else if (toolMode === 'pen' && isDrawingRef.current) {
        const p = relativePoint(e);
        strokeRef.current = [...strokeRef.current, p];
        setCurrentStroke(strokeRef.current);
      }
    },
    [toolMode, relativePoint]
  );

  const handleStagePointerUp = useCallback(() => {
    if (toolMode !== 'pen' || !isDrawingRef.current) return;
    isDrawingRef.current = false;
    const pts = strokeRef.current;
    strokeRef.current = [];
    setCurrentStroke(null);
    if (pts.length > 1 && currentSlideId) {
      setPenStrokes((strokes) => ({
        ...strokes,
        [currentSlideId]: [...(strokes[currentSlideId] ?? []), { points: pts }],
      }));
    }
  }, [toolMode, currentSlideId]);

  const handleStagePointerLeave = useCallback(() => {
    setLaserPos(null);
  }, []);

  useEffect(() => {
    if (toolMode !== 'laser') setLaserPos(null);
    if (toolMode !== 'pen') {
      isDrawingRef.current = false;
      strokeRef.current = [];
      setCurrentStroke(null);
    }
  }, [toolMode]);

  useEffect(() => {
    isDrawingRef.current = false;
    strokeRef.current = [];
    setCurrentStroke(null);
  }, [currentSlideId]);

  const [teleprompterSpeed, setTeleprompterSpeed] = useState<number>(1);
  const [teleprompterAutoScroll, setTeleprompterAutoScroll] = useState<boolean>(false);
  const [teleprompterFontSize, setTeleprompterFontSize] = useState<number>(16);
  const notesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const channel = new BroadcastChannel('wozku_presenter_channel');
    channel.onmessage = (e) => {
      if (e.data?.type === 'INDEX' && typeof e.data.index === 'number') setIndex(e.data.index);
      else if (e.data?.type === 'PLAY' && typeof e.data.autoPlay === 'boolean') setAutoPlay(e.data.autoPlay);
      else if (e.data?.type === 'BLANK' && typeof e.data.blank === 'boolean') setBlank(e.data.blank);
    };
    return () => channel.close();
  }, [open]);

  const broadcast = (data: any) => {
    try {
      const channel = new BroadcastChannel('wozku_presenter_channel');
      channel.postMessage(data);
      channel.close();
    } catch {}
  };

  useEffect(() => {
    if (!teleprompterAutoScroll || !notesRef.current) return;
    let animId: number;
    const step = () => {
      if (notesRef.current) notesRef.current.scrollTop += teleprompterSpeed * 0.4;
      animId = requestAnimationFrame(step);
    };
    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [teleprompterAutoScroll, teleprompterSpeed]);

  const total = visible.length;
  const [scale, setScale] = useState(0.5);
  const [picker, setPicker] = useState(false);
  const [idle, setIdle] = useState(false);

  const [sidebarHover, setSidebarHover] = useState(false);
  const showSidebar = picker || sidebarHover;

  const next = useCallback(() => setIndex((i) => Math.min(i + 1, total - 1)), [total]);
  const prev = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), []);

  const togglePlay = useCallback(() => {
    setAutoPlay((v) => {
      const nextState = !v;
      setTimerRunning(nextState);
      return nextState;
    });
  }, []);

  // Reset state on open
  useEffect(() => {
    if (!open) return;
    setIndex(Math.min(startIndex, Math.max(0, total - 1)));
    setElapsed(0);
    setTimerRunning(false);
    setBlank(false);
    setPicker(false);
    setSidebarHover(false);
    setAutoPlay(false);
  }, [open, startIndex, total]);

  // Auto-play slideshow (5s interval)
  useEffect(() => {
    if (!open || !autoPlay) return;
    const timer = window.setInterval(() => {
      setIndex((i) => {
        if (i >= total - 1) {
          setAutoPlay(false);
          return i;
        }
        return i + 1;
      });
    }, 5000);
    return () => window.clearInterval(timer);
  }, [open, autoPlay, total]);

  // Fit slide canvas
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

  // Timer interval
  useEffect(() => {
    if (!open || !timerRunning) return;
    const id = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [open, timerRunning]);

  // Auto-hide bottom chrome
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

  // Keyboard navigation
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
        case 'a':
        case 't':
          e.preventDefault();
          togglePlay();
          return;
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
  const chromeVisible = !idle || picker || sidebarHover;

  const activeStrokes = penStrokes[slide.instanceId] ?? [];

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
      <div
        ref={stageRef}
        onClick={toolMode === 'pointer' ? next : undefined}
        onPointerDown={handleStagePointerDown}
        onPointerMove={handleStagePointerMove}
        onPointerUp={handleStagePointerUp}
        onPointerCancel={handleStagePointerUp}
        onPointerLeave={handleStagePointerLeave}
        style={{
          position: 'absolute',
          inset: 0,
          cursor:
            toolMode === 'pen' ? 'crosshair' : toolMode === 'laser' ? 'none' : atEnd ? 'default' : 'pointer',
        }}
        aria-hidden
      />
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        aria-hidden
      >
        {activeStrokes.map((stroke, i) => (
          <polyline
            key={i}
            points={stroke.points.map((p) => `${p.x * 100},${p.y * 100}`).join(' ')}
            fill="none"
            stroke="#ef4444"
            strokeWidth={0.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {currentStroke && currentStroke.length > 1 && (
          <polyline
            points={currentStroke.map((p) => `${p.x * 100},${p.y * 100}`).join(' ')}
            fill="none"
            stroke="#ef4444"
            strokeWidth={0.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      {toolMode === 'laser' && laserPos && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: `${laserPos.x * 100}%`,
            top: `${laserPos.y * 100}%`,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(239,68,68,0.95) 0%, rgba(239,68,68,0.4) 55%, transparent 100%)',
            boxShadow: '0 0 14px 4px rgba(239,68,68,0.65)',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
          }}
        />
      )}
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
      {/* Edge hover trigger area for macOS dock style reveal */}
      <div
        onMouseEnter={() => setSidebarHover(true)}
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          width: 16,
          zIndex: 120,
        }}
      />

      {/* Floating edge handle pill when drawer is hidden */}
      {!showSidebar && (
        <button
          type="button"
          onClick={() => setPicker(true)}
          onMouseEnter={() => setSidebarHover(true)}
          title="Jump to slide (G)"
          style={{
            position: 'fixed',
            left: 0,
            top: 24,
            zIndex: 125,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '10px 10px 10px 8px',
            border: CHROME_BORDER,
            borderLeft: 'none',
            borderRadius: '0 12px 12px 0',
            background: CHROME_BG,
            backdropFilter: 'blur(12px)',
            color: 'rgba(255,255,255,0.85)',
            cursor: 'pointer',
            boxShadow: '4px 0 20px rgba(0,0,0,0.4)',
            transition: 'opacity 0.2s',
            opacity: chromeVisible ? 1 : 0.4,
          }}
        >
          <LayersIcon size={16} />
        </button>
      )}

      {/* Auto-Hiding Jump-to-Slide Floating Sidebar */}
      <aside
        onMouseEnter={() => setSidebarHover(true)}
        onMouseLeave={() => setSidebarHover(false)}
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          width: 300,
          zIndex: 130,
          background: 'rgba(12, 13, 16, 0.96)',
          backdropFilter: 'blur(20px)',
          borderRight: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '12px 0 32px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          transform: showSidebar ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 18px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <LayersIcon size={16} />
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.85)',
              }}
            >
              Slides ({total})
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setPicker(false);
              setSidebarHover(false);
            }}
            title="Close sidebar (Esc)"
            style={{
              border: 'none',
              background: 'transparent',
              color: 'rgba(255,255,255,0.4)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 4,
            }}
          >
            <CloseIcon size={14} />
          </button>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {visible.map((s, i) => (
            <button
              key={s.instanceId}
              type="button"
              onClick={() => setIndex(i)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                padding: 6,
                border: i === index ? '2px solid var(--emerald-500)' : '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8,
                background: i === index ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255,255,255,0.03)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'border-color 0.15s, background 0.15s',
              }}
            >
              <div style={{ borderRadius: 4, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                <FitStage slide={s} ast={ast} num={pad(i + 1)} logoUrl={deck.logoUrl} theme={theme} />
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '0 2px' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    fontWeight: 700,
                    color: i === index ? 'var(--emerald-400)' : 'rgba(255,255,255,0.4)',
                  }}
                >
                  {pad(i + 1)}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: i === index ? '#fff' : 'rgba(255,255,255,0.7)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {s.title}
                </span>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Stage Area */}
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
                    label={autoPlay ? 'Pause timer & auto-play (A)' : 'Start timer & auto-play (A)'}
                    onClick={togglePlay}
                  >
                    {autoPlay ? <PauseCircleIcon size={18} /> : <PlayCircleIcon size={18} />}
                  </BarButton>
                  <BarButton label="Reset timer" onClick={() => setElapsed(0)}>
                    <RefreshIcon size={14} />
                  </BarButton>
                </span>
              </div>

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

              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flex: 1, minHeight: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
                    Notes & Teleprompter
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => setTeleprompterAutoScroll((v) => !v)}
                      style={{
                        background: teleprompterAutoScroll ? 'var(--emerald-500)' : 'rgba(255,255,255,0.1)',
                        color: '#fff', border: 'none', borderRadius: 3, padding: '2px 6px',
                        fontSize: 10, fontFamily: 'var(--font-mono)', cursor: 'pointer',
                      }}
                    >
                      {teleprompterAutoScroll ? 'Scroll: ON' : 'Scroll: OFF'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTeleprompterSpeed((s) => (s >= 2 ? 1 : s + 0.5))}
                      style={{
                        background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)',
                        border: 'none', borderRadius: 3, padding: '2px 6px',
                        fontSize: 10, fontFamily: 'var(--font-mono)', cursor: 'pointer',
                      }}
                    >
                      {teleprompterSpeed}x
                    </button>
                    <button
                      type="button"
                      onClick={() => setTeleprompterFontSize((fs) => (fs >= 24 ? 14 : fs + 2))}
                      style={{
                        background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)',
                        border: 'none', borderRadius: 3, padding: '2px 6px',
                        fontSize: 10, fontFamily: 'var(--font-mono)', cursor: 'pointer',
                      }}
                    >
                      {teleprompterFontSize}px
                    </button>
                  </div>
                </div>
                <div
                  ref={notesRef}
                  style={{
                    flex: 1,
                    minHeight: 90,
                    overflowY: 'auto',
                    padding: '11px 13px',
                    background: 'rgba(255,255,255,0.055)',
                    border: CHROME_BORDER,
                    color: 'rgba(255,255,255,0.88)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: teleprompterFontSize,
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

      {/* Presenter Bar */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <button
              onClick={() => setPicker((v) => !v)}
              title="Toggle slides sidebar (G)"
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

          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            {!presenter && (
              <>
                <BarButton
                  label={autoPlay ? 'Pause Auto-Play (A)' : 'Start Auto-Play (5s per slide) (A)'}
                  onClick={togglePlay}
                  active={autoPlay}
                >
                  {autoPlay ? <PauseCircleIcon size={18} /> : <PlayCircleIcon size={18} />}
                </BarButton>
                <span
                  style={{
                    padding: '4px 8px',
                    color: autoPlay ? '#fff' : 'rgba(255,255,255,0.4)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12.5,
                    fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums',
                    userSelect: 'none',
                  }}
                >
                  {formatElapsed(elapsed)}
                </span>
                <span style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.12)', margin: '0 5px' }} />
              </>
            )}

            <BarButton
              label="Laser Pointer"
              onClick={() => setToolMode((m) => (m === 'laser' ? 'pointer' : 'laser'))}
              active={toolMode === 'laser'}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: toolMode === 'laser' ? '#ef4444' : 'inherit' }}>🔴</span>
            </BarButton>
            <BarButton
              label="Annotation Pen"
              onClick={() => setToolMode((m) => (m === 'pen' ? 'pointer' : 'pen'))}
              active={toolMode === 'pen'}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: toolMode === 'pen' ? 'var(--emerald-400)' : 'inherit' }}>✏️</span>
            </BarButton>
            {penStrokes[slide.instanceId]?.length ? (
              <BarButton label="Clear annotations" onClick={() => setPenStrokes((s) => ({ ...s, [slide.instanceId]: [] }))}>
                <span style={{ fontSize: 11, fontWeight: 600 }}>Clear Ink</span>
              </BarButton>
            ) : null}

            <BarButton label="Blank the screen (B)" onClick={() => { setBlank(true); broadcast({ type: 'BLANK', blank: true }); }}>
              <EyeOffIcon size={16} />
            </BarButton>
            <BarButton
              label="Presenter view (P)"
              onClick={() => setPresenter((v) => !v)}
              active={presenter}
              wide
            >
              <DocumentTextIcon size={15} />
              Notes
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

