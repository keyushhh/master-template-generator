import { initialsOf } from '../auth/demoUsers';
import type { CollabPeer } from './collabChannel';

interface Props {
  peers: CollabPeer[];
  followingUserId?: string | null;
  onToggleFollow?: (userId: string) => void;
  reachableSlideIds?: Set<string>;
}

/** Who else is in this deck, as overlapping avatars in the top bar. */
export function PresenceStack({
  peers,
  followingUserId,
  onToggleFollow,
  reachableSlideIds,
}: Props) {
  if (!peers.length) return null;

  // One person can have the deck open in three tabs; show the person once
  const byUser = new Map<string, CollabPeer>();
  for (const peer of peers) {
    const seen = byUser.get(peer.userId);
    if (!seen || peer.at > seen.at) byUser.set(peer.userId, peer);
  }
  const unique = [...byUser.values()];

  return (
    <div className="flex items-center">
      {unique.slice(0, 4).map((peer, i) => {
        const isFollowing = followingUserId === peer.userId;
        const canFollow = Boolean(
          onToggleFollow && (!reachableSlideIds || !peer.slideId || reachableSlideIds.has(peer.slideId))
        );

        return (
          <button
            key={peer.clientId}
            type="button"
            disabled={!canFollow}
            onClick={() => canFollow && onToggleFollow!(peer.userId)}
            title={
              isFollowing
                ? `Following ${peer.name} (click to stop)`
                : `Click to follow ${peer.name}`
            }
            aria-label={isFollowing ? `Following ${peer.name}` : `Follow ${peer.name}`}
            className={`relative w-[28px] h-[28px] flex items-center justify-center text-[10px] font-mono font-bold text-white select-none transition-all enabled:cursor-pointer disabled:cursor-default ${
              isFollowing
                ? 'scale-110 z-20 shadow-md ring-2 ring-offset-1 ring-neutral-900'
                : 'border-2 border-white enabled:hover:-translate-y-0.5'
            }`}
            style={{
              backgroundColor: peer.color,
              marginLeft: i === 0 ? 0 : -8,
              zIndex: isFollowing ? 25 : 10 - i,
            }}
          >
            {initialsOf(peer.name)}

            {/* Spotlight following indicator badge */}
            {isFollowing && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-neutral-900 border border-white rounded-none flex items-center justify-center">
                <span className="w-1 h-1 bg-emerald-400 rounded-none animate-ping" />
              </span>
            )}
          </button>
        );
      })}

      {unique.length > 4 && (
        <span
          title={unique.slice(4).map((p) => p.name).join(', ')}
          className="w-[28px] h-[28px] flex items-center justify-center text-[9.5px] font-mono font-bold text-neutral-600 bg-neutral-200 select-none border-2 border-white"
          style={{ marginLeft: -8, zIndex: 1 }}
        >
          +{unique.length - 4}
        </span>
      )}
    </div>
  );
}
