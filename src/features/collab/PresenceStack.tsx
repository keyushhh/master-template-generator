import { initialsOf } from '../auth/demoUsers';
import type { CollabPeer } from './collabChannel';

interface Props {
  peers: CollabPeer[];
  /** Jump to the slide someone is on. Absent when there is nowhere to jump to. */
  onFollow?: (slideId: string) => void;
  /** Slides that can actually be jumped to, so a peer on a hidden or deleted
   *  one is shown but not offered as a destination. */
  reachableSlideIds?: Set<string>;
}

/** Who else is in this deck, as overlapping avatars in the top bar. */
export function PresenceStack({ peers, onFollow, reachableSlideIds }: Props) {
  if (!peers.length) return null;
  // One person can have the deck open in three tabs; show the person once, and
  // follow the most recent of their tabs.
  const byUser = new Map<string, CollabPeer>();
  for (const peer of peers) {
    const seen = byUser.get(peer.userId);
    if (!seen || peer.at > seen.at) byUser.set(peer.userId, peer);
  }
  const unique = [...byUser.values()];

  return (
    <div className="flex items-center">
      {unique.slice(0, 4).map((peer, i) => {
        const canFollow = Boolean(
          onFollow && peer.slideId && (!reachableSlideIds || reachableSlideIds.has(peer.slideId))
        );
        return (
          <button
            key={peer.clientId}
            type="button"
            disabled={!canFollow}
            onClick={() => canFollow && onFollow!(peer.slideId!)}
            title={canFollow ? `Go to where ${peer.name} is` : `${peer.name} is also here`}
            aria-label={canFollow ? `Go to where ${peer.name} is` : `${peer.name} is also here`}
            className="w-[26px] h-[26px] flex items-center justify-center text-[9.5px] font-mono font-bold text-white select-none border-2 border-white transition-transform enabled:hover:-translate-y-0.5 enabled:cursor-pointer disabled:cursor-default"
            style={{ backgroundColor: peer.color, marginLeft: i === 0 ? 0 : -8, zIndex: 10 - i }}
          >
            {initialsOf(peer.name)}
          </button>
        );
      })}
      {unique.length > 4 && (
        <span
          title={unique.slice(4).map((p) => p.name).join(', ')}
          className="w-[26px] h-[26px] flex items-center justify-center text-[9.5px] font-mono font-bold text-neutral-600 bg-neutral-200 select-none border-2 border-white"
          style={{ marginLeft: -8 }}
        >
          +{unique.length - 4}
        </span>
      )}
    </div>
  );
}
