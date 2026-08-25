import { useEffect, useState } from 'react';
import type { CollabPeer } from './collabChannel';

const SLIDE_W = 1920;

/**
 * Other people's pointers, drawn over the slide they are actually on.
 *
 * Positions travel in the slide's own 1920x1080 space and are converted back
 * here against the live slide rect, so a cursor lands on the same word for
 * everyone whatever their zoom or window size.
 */
export function RemoteCursors({ peers, slideId }: { peers: CollabPeer[]; slideId: string | null }) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  // The slide moves under the cursors when the window resizes or the rail
  // opens, and presence alone would not repaint them until the next heartbeat.
  useEffect(() => {
    const measure = () => {
      const stage = document.querySelector<HTMLElement>('[data-slide]');
      setRect(stage?.getBoundingClientRect() ?? null);
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [slideId, peers.length]);

  const here = peers.filter(
    (p) => p.slideId && p.slideId === slideId && p.x !== undefined && p.y !== undefined
  );
  if (!here.length || !rect || rect.width <= 0) return null;
  const scale = rect.width / SLIDE_W;

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 90 }}>
      {here.map((peer) => {
        const isChatActive =
          peer.chat?.text && Date.now() - (peer.chat.sentAt || 0) < 15_000;

        return (
          <div
            key={peer.clientId}
            style={{
              position: 'absolute',
              left: rect.left + peer.x! * scale,
              top: rect.top + peer.y! * scale,
              transition: 'left .08s linear, top .08s linear',
              willChange: 'left, top',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" style={{ display: 'block' }}>
              <path
                d="M5.5 2.8 19 10.2l-6.2 1.5-2.6 6z"
                fill={peer.color}
                stroke="#fff"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>

            {/* If peer has an active chat message, show the sleek speech bubble in peer color */}
            {isChatActive ? (
              <div
                style={{
                  position: 'absolute',
                  left: 14,
                  top: 10,
                  display: 'flex',
                  alignItems: 'center',
                  padding: '6px 14px',
                  borderRadius: '4px 16px 16px 16px',
                  backgroundColor: peer.color,
                  border: '1.5px solid rgba(255, 255, 255, 0.35)',
                  color: '#FFFFFF',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  lineHeight: '1.3',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35), 0 2px 6px rgba(0, 0, 0, 0.2)',
                  whiteSpace: 'nowrap',
                  maxWidth: '320px',
                  fontFamily: 'var(--font-sans)',
                  pointerEvents: 'none',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {peer.chat!.text}
                </span>
              </div>
            ) : (
              /* Otherwise show normal name badge */
              <span
                style={{
                  position: 'absolute',
                  left: 15,
                  top: 16,
                  padding: '3px 9px',
                  borderRadius: 6,
                  background: peer.color,
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 700,
                  lineHeight: '16px',
                  letterSpacing: '-0.01em',
                  whiteSpace: 'nowrap',
                  fontFamily: 'var(--font-sans)',
                  boxShadow: '0 2px 8px rgba(15,23,20,0.24)',
                }}
              >
                {peer.name}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
