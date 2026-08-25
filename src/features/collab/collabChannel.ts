import type { Deck } from '../deck/types';
import type { CommentAction } from '../comments/types';

export interface ReactionEvent {
  id: string;
  clientId: string;
  emoji: string;
  x: number;
  y: number;
  userName: string;
  userColor: string;
  createdAt: number;
}

export interface CollabPeer {
  clientId: string;
  userId: string;
  name: string;
  color: string;
  /** Slide the peer is looking at, so presence can be shown per slide. */
  slideId?: string;
  /** Currently selected shape or slot IDs on that slide. */
  selectedIds?: string[];
  /** Pointer position in the 1920x1080 design space, absent when off-canvas. */
  x?: number;
  y?: number;
  /** Live cursor chat message (Figma-style ephemeral chat). */
  chat?: {
    text: string;
    sentAt: number;
  };
  at: number;
}

export interface LaserPoint {
  x: number;
  y: number;
  at: number;
}

export interface RemoteLaserEvent {
  clientId: string;
  userId: string;
  userName: string;
  color: string;
  points: LaserPoint[];
}

export interface SummonEvent {
  clientId: string;
  userId: string;
  userName: string;
  userColor: string;
  slideId: string;
  slideIndex: number;
  sentAt: number;
}

export type CollabMessage =
  | { kind: 'edit'; clientId: string; deck: Deck; userId: string }
  | { kind: 'presence'; peer: CollabPeer }
  | { kind: 'chat'; clientId: string; chat?: { text: string; sentAt: number } }
  | { kind: 'selection'; clientId: string; slideId?: string; selectedIds: string[] }
  | { kind: 'reaction'; reaction: ReactionEvent }
  | { kind: 'laser'; laser: RemoteLaserEvent }
  | { kind: 'summon'; summon: SummonEvent }
  | { kind: 'comment'; clientId: string; action: CommentAction }
  | { kind: 'leave'; clientId: string };

/** A peer that has not been heard from in this long has closed its tab. */
export const PEER_TIMEOUT_MS = 5_000;

/** How often presence is re-announced, comfortably inside the timeout. */
export const PRESENCE_INTERVAL_MS = 2_000;

export function channelName(projectId: string): string {
  return `wozku-collab-${projectId}`;
}

/** Opens the deck's channel. Returns null where BroadcastChannel is missing,
 *  which leaves every caller as a single-player editor rather than broken. */
export function openCollabChannel(projectId: string): BroadcastChannel | null {
  try {
    return new BroadcastChannel(channelName(projectId));
  } catch {
    return null;
  }
}

export function newClientId(): string {
  return `c_${crypto.randomUUID()}`;
}
