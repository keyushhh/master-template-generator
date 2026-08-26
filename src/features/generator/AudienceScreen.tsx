import { useEffect, useMemo, useRef, useState } from 'react';
import { FitStage } from './FitStage';
import type { DocumentNode } from '../business-record/parser/ast';
import type { Deck } from '../deck/types';
import { WOZKU_THEME, type DeckTheme } from '../theme/deckTheme';
import { PRESENTER_CHANNEL, type PresenterMessage } from './presenterChannel';

/**
 * The window you drag onto the projector.
 *
 * Presenter view lived in the same window as the slide, so a laptop with a
 * second display could show the room either the slide or the notes and not
 * both. This is the other half: a window with nothing in it but the slide,
 * following the presenter's window over the same BroadcastChannel present mode
 * already used to keep two tabs in step.
 *
 * It holds no deck of its own and reads nothing from storage. On open it says
 * hello, the presenter's window answers with the deck it is presenting, and
 * from then on it follows. That is what makes it work on an unsaved deck, and
 * it is why closing the presenter's window leaves this one saying so rather
 * than quietly showing a deck from an hour ago.
 */
export function AudienceScreen() {
  const [deck, setDeck] = useState<Deck | null>(null);
  const [ast, setAst] = useState<DocumentNode | null>(null);
  const [theme, setTheme] = useState<DeckTheme>(WOZKU_THEME);
  const [index, setIndex] = useState(0);
  const [blank, setBlank] = useState(false);
  const [live, setLive] = useState(false);
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    document.title = 'Wozku · Audience screen';
    const channel = new BroadcastChannel(PRESENTER_CHANNEL);
    channelRef.current = channel;
    channel.onmessage = (e: MessageEvent<PresenterMessage>) => {
      const data = e.data;
      if (!data) return;
      if (data.type === 'DECK') {
        setDeck(data.deck);
        setAst(data.ast ?? null);
        setTheme(data.theme ?? WOZKU_THEME);
        setIndex(data.index ?? 0);
        setBlank(Boolean(data.blank));
        setLive(true);
      } else if (data.type === 'INDEX') {
        setIndex(data.index);
        setLive(true);
      } else if (data.type === 'BLANK') {
        setBlank(data.blank);
      } else if (data.type === 'BYE') {
        // The presenting window has gone. Holding the last slide up on a
        // projector after the meeting has moved on is worse than showing
        // nothing, so it goes.
        setLive(false);
        setDeck(null);
        setBlank(false);
      }
    };
    // The presenter answers this with the deck.
    channel.postMessage({ type: 'HELLO' } satisfies PresenterMessage);
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, []);

  // Keeps asking while nothing is presenting, so the order the two windows are
  // opened in does not matter and closing a presentation does not mean closing
  // this window too: start presenting again and the screen picks it up.
  useEffect(() => {
    if (live) return;
    const ask = window.setInterval(() => {
      channelRef.current?.postMessage({ type: 'HELLO' } satisfies PresenterMessage);
    }, 2000);
    return () => window.clearInterval(ask);
  }, [live]);

  const visible = useMemo(() => deck?.slides.filter((s) => !s.hidden) ?? [], [deck]);
  const slide = visible[Math.min(index, Math.max(visible.length - 1, 0))];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        cursor: 'none',
      }}
    >
      {slide && !blank ? (
        // 16:9 inside whatever shape the window is, so the slide is never
        // cropped and never stretched on a projector of a different aspect.
        <div style={{ width: 'min(100vw, calc(100vh * 16 / 9))' }}>
          <FitStage slide={slide} ast={ast} num={String(index + 1).padStart(2, '0')} logoUrl={deck?.logoUrl} theme={theme} />
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 32, maxWidth: 460 }}>
          <p
            style={{
              margin: 0,
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.45)',
            }}
          >
            {blank ? 'Screen blanked' : live ? 'Nothing to show' : 'Audience screen'}
          </p>
          {!blank && (
            <p style={{ marginTop: 14, marginBottom: 0, fontSize: 14.5, lineHeight: 1.6, color: 'rgba(255,255,255,0.75)' }}>
              {live
                ? 'The presenting window has no visible slides.'
                : 'Waiting for the presenting window. Drag this onto your second display and make it full screen.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
