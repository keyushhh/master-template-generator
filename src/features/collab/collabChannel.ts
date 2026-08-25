import type { Deck } from '../deck/types';

/**
 * Live editing between tabs of the same browser.
 *
 * BroadcastChannel reaches every tab on this origin and nothing beyond it, so
 * two people on two machines cannot see each other. That is the deliberate
 * limit of a build with no backend: the seam is this file, and a real server
 * would replace its transport without the callers noticing.
 */

export interface CollabPeer {
  clientId: string;
  userId: string;
  name: string;
  color: string;
  /** Slide the peer is looking at, so presence can be shown per slide. */
  slideId?: string;
  /** Pointer position in the 1920x1080 design space, absent when off-canvas. */
  x?: number;
  y?: number;
  at: number;
}

export type CollabMessage =
  | { kind: 'edit'; clientId: string; deck: Deck; userId: string }
  | { kind: 'presence'; peer: CollabPeer }
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
