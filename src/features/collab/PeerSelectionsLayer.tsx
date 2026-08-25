import { useEffect, useState, useRef } from 'react';
import type { CollabPeer } from './collabChannel';
import { initialsOf } from '../auth/demoUsers';

interface Props {
  peers: CollabPeer[];
  currentSlideId: string;
  slideContainerRef?: React.RefObject<HTMLDivElement | null>;
}

interface PeerBox {
  id: string;
  peerName: string;
  peerColor: string;
  rect: { left: number; top: number; width: number; height: number };
}

function findTargetElement(targetId: string): HTMLElement | null {
  // 1. Search inside stage/slide first
  const stage = document.querySelector('[data-slide]') || document.body;
  
  // Direct attribute match
  const match = stage.querySelector<HTMLElement>(
    `[data-slot="${CSS.escape(targetId)}"], [data-slot-frame="${CSS.escape(targetId)}"], [data-shape-id="${CSS.escape(targetId)}"], [data-overlay-id="${CSS.escape(targetId)}"], [data-field="${CSS.escape(targetId)}"], #${CSS.escape(targetId)}`
  );
  if (match) return match;

  // Fallback iteration
  const all = stage.querySelectorAll<HTMLElement>(
    '[data-slot], [data-slot-frame], [data-shape-id], [data-overlay-id], [data-field]'
  );
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    if (
      el.dataset.slot === targetId ||
      el.dataset.slotFrame === targetId ||
      el.dataset.shapeId === targetId ||
      el.dataset.overlayId === targetId ||
      el.dataset.field === targetId ||
      el.id === targetId
    ) {
      return el;
    }
  }

  return null;
}

export function PeerSelectionsLayer({ peers, currentSlideId }: Props) {
  const [boxes, setBoxes] = useState<PeerBox[]>([]);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    const updateBoxes = () => {
      const activePeers = peers.filter(
        (p) => (!p.slideId || p.slideId === currentSlideId) && p.selectedIds && p.selectedIds.length > 0
      );

      if (!activePeers.length) {
        setBoxes([]);
        return;
      }

      const nextBoxes: PeerBox[] = [];

      activePeers.forEach((peer) => {
        peer.selectedIds?.forEach((targetId) => {
          const el = findTargetElement(targetId);
          if (el) {
            const elRect = el.getBoundingClientRect();
            if (elRect.width > 0 && elRect.height > 0) {
              nextBoxes.push({
                id: `${peer.clientId}_${targetId}`,
                peerName: peer.name,
                peerColor: peer.color,
                rect: {
                  left: elRect.left,
                  top: elRect.top,
                  width: elRect.width,
                  height: elRect.height,
                },
              });
            }
          }
        });
      });

      setBoxes(nextBoxes);
    };

    updateBoxes();

    // Re-measure on window resize or scroll
    window.addEventListener('resize', updateBoxes);
    window.addEventListener('scroll', updateBoxes, true);

    // Run active poll loop while peers are selecting to track live typing or animations
    const interval = window.setInterval(updateBoxes, 120);

    return () => {
      window.removeEventListener('resize', updateBoxes);
      window.removeEventListener('scroll', updateBoxes, true);
      window.clearInterval(interval);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [peers, currentSlideId]);

  if (!boxes.length) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 130,
        overflow: 'hidden',
      }}
    >
      {boxes.map((box) => (
        <div
          key={box.id}
          style={{
            position: 'fixed',
            left: box.rect.left - 2,
            top: box.rect.top - 2,
            width: box.rect.width + 4,
            height: box.rect.height + 4,
            border: `2px solid ${box.peerColor}`,
            boxShadow: `0 0 0 1px #FFFFFF, inset 0 0 0 1px rgba(255,255,255,0.4)`,
            borderRadius: 0,
            pointerEvents: 'none',
            transition: 'left 0.05s ease-out, top 0.05s ease-out, width 0.05s ease-out, height 0.05s ease-out',
          }}
        >
          {/* Peer Name Tag Badge */}
          <div
            style={{
              position: 'absolute',
              top: -20,
              left: -2,
              backgroundColor: box.peerColor,
              color: '#FFFFFF',
              fontSize: '10px',
              fontFamily: 'var(--font-mono, monospace)',
              fontWeight: 700,
              padding: '1px 6px',
              display: 'flex',
              alignItems: 'center',
              gap: 3.5,
              whiteSpace: 'nowrap',
              borderRadius: 0,
              boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
              border: '1px solid rgba(255,255,255,0.3)',
              pointerEvents: 'none',
            }}
          >
            <span>{initialsOf(box.peerName)}</span>
            <span>{box.peerName}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
