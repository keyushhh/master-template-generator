import type { DeckComment, CommentReply, CommentAction } from './types';

const COMMENTS_STORAGE_PREFIX = 'wozku-comments-';

export function getCommentsStorageKey(projectId: string): string {
  return `${COMMENTS_STORAGE_PREFIX}${projectId}`;
}

export function loadDeckComments(projectId: string): DeckComment[] {
  try {
    const raw = localStorage.getItem(getCommentsStorageKey(projectId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveDeckComments(projectId: string, comments: DeckComment[]): void {
  try {
    localStorage.setItem(getCommentsStorageKey(projectId), JSON.stringify(comments));
  } catch {
    // Storage quota or disabled localStorage
  }
}

export function applyCommentAction(
  comments: DeckComment[],
  action: CommentAction
): DeckComment[] {
  switch (action.type) {
    case 'create': {
      // Don't duplicate if already exists
      if (comments.some((c) => c.id === action.comment.id)) return comments;
      return [...comments, action.comment];
    }
    case 'reply': {
      return comments.map((c) => {
        if (c.id !== action.commentId) return c;
        if (c.replies.some((r) => r.id === action.reply.id)) return c;
        return {
          ...c,
          replies: [...c.replies, action.reply],
        };
      });
    }
    case 'resolve': {
      return comments.map((c) => {
        if (c.id !== action.commentId) return c;
        return {
          ...c,
          resolved: action.resolved,
          resolvedAt: action.resolved ? Date.now() : undefined,
          resolvedBy: action.resolved ? action.resolvedBy : undefined,
        };
      });
    }
    case 'delete': {
      return comments.filter((c) => c.id !== action.commentId);
    }
    case 'move': {
      return comments.map((c) => {
        if (c.id !== action.commentId) return c;
        return {
          ...c,
          x: action.x,
          y: action.y,
        };
      });
    }
    default:
      return comments;
  }
}
