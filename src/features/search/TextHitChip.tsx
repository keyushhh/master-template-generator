import type { DeckTextHit } from './deckText';

/** Why a deck is in the results when its name does not contain the query. */
export function TextHitChip({ hit }: { hit: DeckTextHit }) {
  return (
    <span
      className="shrink-0 inline-flex items-center gap-1 px-1.5 py-[1px] border max-w-[220px]"
      style={{ borderColor: 'var(--neutral-300)', background: 'var(--neutral-100)' }}
      title={`Slide ${hit.slideNumber}, ${hit.slideTitle}: ${hit.snippet}`}
    >
      <span className="shrink-0 font-mono text-[9px] font-bold uppercase tracking-[0.06em] text-neutral-700">
        Slide {hit.slideNumber}
      </span>
      <span className="truncate text-[10px] text-neutral-700">{hit.snippet}</span>
    </span>
  );
}
