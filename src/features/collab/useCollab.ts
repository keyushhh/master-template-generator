import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Deck } from '../deck/types';
import type { DemoUser } from '../auth/demoUsers';
import {
  newClientId,
  openCollabChannel,
  PEER_TIMEOUT_MS,
  PRESENCE_INTERVAL_MS,
  type CollabMessage,
  type CollabPeer,
} from './collabChannel';

import type { CommentAction } from '../comments/types';

/** Fast enough to read as a live cursor, slow enough not to flood the channel. */
const POINTER_THROTTLE_MS = 60;

interface Options {
  projectId: string;
  user: DemoUser | null;
  /** Applied when another tab edits the deck. Must not push onto undo history. */
  onRemoteDeck: (deck: Deck) => void;
  /** Applied when another tab creates, replies to, or resolves a comment. */
  onRemoteComment?: (action: CommentAction) => void;
}

interface Collab {
  /** Everyone else currently in this deck. */
  peers: CollabPeer[];
  /** Tell the others about a local commit. */
  broadcastDeck: (deck: Deck) => void;
  /** Tell the others which slide is on screen here. */
  reportSlide: (slideId: string | undefined) => void;
  /** Tell the others where this cursor is, or nothing once it leaves. */
  reportPointer: (x?: number, y?: number) => void;
  /** Broadcast live cursor chat message (Figma-style ephemeral chat). */
  reportChat: (text?: string) => void;
  /** Broadcast comment creation/reply/resolve/delete. */
  broadcastComment: (action: CommentAction) => void;
}

export function useCollab({ projectId, user, onRemoteDeck, onRemoteComment }: Options): Collab {
  const clientId = useMemo(newClientId, []);
  const [peers, setPeers] = useState<CollabPeer[]>([]);
  const channelRef = useRef<BroadcastChannel | null>(null);
  // Which slide someone is on outlives where their pointer is: they stay on the
  // slide when the cursor leaves the canvas, and that is the thing worth
  // following them to.
  const slideRef = useRef<string | undefined>(undefined);
  const pointerRef = useRef<{ x?: number; y?: number }>({});
  const chatRef = useRef<{ text: string; sentAt: number } | undefined>(undefined);
  const announceRef = useRef<() => void>(() => {});
  const lastPointerSendRef = useRef(0);

  // Read through a ref so the subscribe effect does not tear down and rebuild
  // the channel every time the parent re-renders with a new callback.
  const onRemoteDeckRef = useRef(onRemoteDeck);
  onRemoteDeckRef.current = onRemoteDeck;

  const onRemoteCommentRef = useRef(onRemoteComment);
  onRemoteCommentRef.current = onRemoteComment;

  useEffect(() => {
    if (!user) return;
    const channel = openCollabChannel(projectId);
    channelRef.current = channel;
    if (!channel) return;

    channel.onmessage = (e: MessageEvent<CollabMessage>) => {
      const msg = e.data;
      if (!msg) return;
      if (msg.kind === 'edit' && msg.clientId !== clientId) {
        onRemoteDeckRef.current(msg.deck);
      } else if (msg.kind === 'presence' && msg.peer.clientId !== clientId) {
        setPeers((prev) => [...prev.filter((p) => p.clientId !== msg.peer.clientId), msg.peer]);
      } else if (msg.kind === 'chat' && msg.clientId !== clientId) {
        setPeers((prev) =>
          prev.map((p) => (p.clientId === msg.clientId ? { ...p, chat: msg.chat } : p))
        );
      } else if (msg.kind === 'comment' && msg.clientId !== clientId) {
        onRemoteCommentRef.current?.(msg.action);
      } else if (msg.kind === 'leave') {
        setPeers((prev) => prev.filter((p) => p.clientId !== msg.clientId));
      }
    };

    const announce = () => {
      const peer: CollabPeer = {
        clientId,
        userId: user.id,
        name: user.name,
        color: user.color,
        slideId: slideRef.current,
        ...pointerRef.current,
        chat: chatRef.current,
        at: Date.now(),
      };
      try {
        channel.postMessage({ kind: 'presence', peer } satisfies CollabMessage);
      } catch {
        // A closed channel just means this tab is on its way out.
      }
    };
    announceRef.current = announce;
    announce();
    const timer = setInterval(announce, PRESENCE_INTERVAL_MS);

    // Drop anyone whose tab closed without saying so.
    const sweep = setInterval(() => {
      const cutoff = Date.now() - PEER_TIMEOUT_MS;
      setPeers((prev) => (prev.some((p) => p.at < cutoff) ? prev.filter((p) => p.at >= cutoff) : prev));
    }, PEER_TIMEOUT_MS / 2);

    const leave = () => {
      try {
        channel.postMessage({ kind: 'leave', clientId } satisfies CollabMessage);
      } catch {
        // ignore
      }
    };
    window.addEventListener('pagehide', leave);

    return () => {
      leave();
      window.removeEventListener('pagehide', leave);
      clearInterval(timer);
      clearInterval(sweep);
      channel.close();
      channelRef.current = null;
      setPeers([]);
    };
  }, [projectId, user, clientId]);

  const broadcastDeck = useCallback((deck: Deck) => {
    if (!user) return;
    try {
      channelRef.current?.postMessage({ kind: 'edit', clientId, deck, userId: user.id } satisfies CollabMessage);
    } catch {
      // A deck too large to structured-clone is still edited locally.
    }
  }, [clientId, user]);

  const broadcastComment = useCallback((action: CommentAction) => {
    if (!user) return;
    try {
      channelRef.current?.postMessage({ kind: 'comment', clientId, action } satisfies CollabMessage);
    } catch {
      // ignore
    }
  }, [clientId, user]);

  // Rare enough to send the moment it happens, and the others need it promptly
  // to be able to follow.
  const reportSlide = useCallback((slideId: string | undefined) => {
    if (slideRef.current === slideId) return;
    slideRef.current = slideId;
    announceRef.current();
  }, []);

  // Sent as it moves rather than on the presence heartbeat, or a remote cursor
  // would jump once every couple of seconds instead of tracking.
  const reportPointer = useCallback((x?: number, y?: number) => {
    pointerRef.current = { x, y };
    const now = Date.now();
    if (now - lastPointerSendRef.current < POINTER_THROTTLE_MS) return;
    lastPointerSendRef.current = now;
    announceRef.current();
  }, []);

  const reportChat = useCallback((text?: string) => {
    const chat = text ? { text, sentAt: Date.now() } : undefined;
    chatRef.current = chat;
    try {
      channelRef.current?.postMessage({ kind: 'chat', clientId, chat } satisfies CollabMessage);
    } catch {
      // ignore
    }
    announceRef.current();
  }, [clientId]);

  return { peers, broadcastDeck, reportSlide, reportPointer, reportChat, broadcastComment };
}
