import { useEffect, useState } from 'react';
import { PresentationCanvas } from '../features/generator/PresentationCanvas';
import type { DocumentNode } from '../features/business-record/parser/ast';
import type { Deck } from '../features/deck/types';

const STORAGE_KEY = 'wozku-master-template-session-v1';

interface PrintSession {
  ast: DocumentNode | null;
  deck: Deck;
}

declare global {
  interface Window {
    /** Injected by the headless-Chrome PDF service before app scripts run. */
    __DECK__?: PrintSession;
  }
}

/**
 * Chrome-only route the PDF backend loads. Renders just the deck canvas (no
 * sidebar/toolbars) inside `.wg-doc` so the existing `@media print` rules apply,
 * then raises `data-print-ready` once fonts + layout have settled - the signal
 * the backend waits on before calling `page.pdf()`.
 */
function readSession(): PrintSession | null {
  // Preferred: injected by the headless renderer.
  if (window.__DECK__?.deck?.slides) return window.__DECK__;
  // Fallback: hydrate from the persisted working session (manual visits).
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { ast?: DocumentNode | null; deck?: Deck };
    if (!parsed.deck || !Array.isArray(parsed.deck.slides)) return null;
    return { ast: parsed.ast ?? null, deck: parsed.deck };
  } catch {
    return null;
  }
}

export function PrintDeckPage() {
  const [session] = useState<PrintSession | null>(() => readSession());

  useEffect(() => {
    let cancelled = false;
    const markReady = () => {
      if (cancelled) return;
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (!cancelled) document.documentElement.setAttribute('data-print-ready', '1');
        })
      );
    };
    // Wait for web fonts (loaded via CDN in index.html) before signalling.
    if (document.fonts?.ready) {
      document.fonts.ready.then(markReady).catch(markReady);
    } else {
      markReady();
    }
    return () => {
      cancelled = true;
    };
  }, []);

  if (!session) {
    return (
      <div className="wg-doc" data-print-error style={{ padding: 48, fontFamily: 'sans-serif' }}>
        No deck available to render.
      </div>
    );
  }

  return (
    <div className="wg-doc">
      <PresentationCanvas
        ast={session.ast}
        deck={session.deck}
        editing={false}
        onEditSlide={() => {}}
      />
    </div>
  );
}
