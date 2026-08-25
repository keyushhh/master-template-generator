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
  type ReactionEvent,
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
  /** Applied when another peer triggers a live reaction burst. */
  onRemoteReaction?: (reaction: ReactionEvent) => void;
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
  /** Tell others which elements are currently selected on the canvas. */
  reportSelection: (selectedIds: string[]) => void;
  /** Broadcast live cursor chat message (Figma-style ephemeral chat). */
  reportChat: (text?: string) => void;
  /** Broadcast particle reaction burst. */
  sendReaction: (emoji: string, x: number, y: number) => void;
  /** Broadcast comment creation/reply/resolve/delete. */
  broadcastComment: (action: CommentAction) => void;
}

export function useCollab({
  projectId,
  user,
  onRemoteDeck,
  onRemoteComment,
  onRemoteReaction,
}: Options): Collab {
  const clientId = useMemo(newClientId, []);
  const [peers, setPeers] = useState<CollabPeer[]>([]);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const slideRef = useRef<string | undefined>(undefined);
  const selectedIdsRef = useRef<string[]>([]);
  const pointerRef = useRef<{ x?: number; y?: number }>({});
  const chatRef = useRef<{ text: string; sentAt: number } | undefined>(undefined);
  const announceRef = useRef<() => void>(() => {});
  const lastPointerSendRef = useRef(0);

  const onRemoteDeckRef = useRef(onRemoteDeck);
  onRemoteDeckRef.current = onRemoteDeck;

  const onRemoteCommentRef = useRef(onRemoteComment);
  onRemoteCommentRef.current = onRemoteComment;

  const onRemoteReactionRef = useRef(onRemoteReaction);
  onRemoteReactionRef.current = onRemoteReaction;

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
      } else if (msg.kind === 'selection' && msg.clientId !== clientId) {
        setPeers((prev) =>
          prev.map((p) =>
            p.clientId === msg.clientId
              ? { ...p, slideId: msg.slideId, selectedIds: msg.selectedIds }
              : p
          )
        );
      } else if (msg.kind === 'reaction') {
        onRemoteReactionRef.current?.(msg.reaction);
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
        selectedIds: selectedIdsRef.current,
        ...pointerRef.current,
        chat: chatRef.current,
        at: Date.now(),
      };
      try {
        channel.postMessage({ kind: 'presence', peer } satisfies CollabMessage);
      } catch {
        // Channel closed while tearing down; ignore.
      }
    };
    announceRef.current = announce;
    announce();

    const interval = window.setInterval(() => {
      setPeers((prev) => prev.filter((p) => Date.now() - p.at < PEER_TIMEOUT_MS));
      announce();
    }, PRESENCE_INTERVAL_MS);

    const onBeforeUnload = () => {
      try {
        channel.postMessage({ kind: 'leave', clientId } satisfies CollabMessage);
      } catch {
        // Ignore unload failures.
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.clearInterval(interval);
      try {
        channel.postMessage({ kind: 'leave', clientId } satisfies CollabMessage);
        channel.close();
      } catch {
        // Ignore teardown failures.
      }
      channelRef.current = null;
    };
  }, [projectId, user, clientId]);

  const broadcastDeck = useCallback(
    (deck: Deck) => {
      if (!user) return;
      channelRef.current?.postMessage({
        kind: 'edit',
        clientId,
        deck,
        userId: user.id,
      } satisfies CollabMessage);
    },
    [clientId, user]
  );

  const reportSlide = useCallback((slideId: string | undefined) => {
    if (slideRef.current === slideId) return;
    slideRef.current = slideId;
    announceRef.current();
  }, []);

  const reportSelection = useCallback(
    (selectedIds: string[]) => {
      selectedIdsRef.current = selectedIds;
      channelRef.current?.postMessage({
        kind: 'selection',
        clientId,
        slideId: slideRef.current,
        selectedIds,
      } satisfies CollabMessage);
    },
    [clientId]
  );

  const reportPointer = useCallback(
    (x?: number, y?: number) => {
      pointerRef.current = { x, y };
      const now = Date.now();
      if (now - lastPointerSendRef.current < POINTER_THROTTLE_MS) return;
      lastPointerSendRef.current = now;
      announceRef.current();
    },
    []
  );

  const reportChat = useCallback(
    (text?: string) => {
      chatRef.current = text ? { text, sentAt: Date.now() } : undefined;
      channelRef.current?.postMessage({
        kind: 'chat',
        clientId,
        chat: chatRef.current,
      } satisfies CollabMessage);
      announceRef.current();
    },
    [clientId]
  );

  const sendReaction = useCallback(
    (emoji: string, x: number, y: number) => {
      if (!user) return;
      const reaction: ReactionEvent = {
        id: `rxn_${crypto.randomUUID()}`,
        clientId,
        emoji,
        x,
        y,
        userName: user.name,
        userColor: user.color,
        createdAt: Date.now(),
      };
      channelRef.current?.postMessage({
        kind: 'reaction',
        reaction,
      } satisfies CollabMessage);
      // Also apply locally
      onRemoteReactionRef.current?.(reaction);
    },
    [clientId, user]
  );

  const broadcastComment = useCallback(
    (action: CommentAction) => {
      channelRef.current?.postMessage({
        kind: 'comment',
        clientId,
        action,
      } satisfies CollabMessage);
    },
    [clientId]
  );

  return {
    peers,
    broadcastDeck,
    reportSlide,
    reportPointer,
    reportSelection,
    reportChat,
    sendReaction,
    broadcastComment,
  };
}
