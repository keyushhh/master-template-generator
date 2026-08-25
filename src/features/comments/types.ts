export interface CommentReply {
  id: string;
  userId: string;
  userName: string;
  userColor: string;
  content: string;
  createdAt: number;
}

export interface DeckComment {
  id: string;
  projectId: string;
  slideId: string;
  x: number; // 0..1920
  y: number; // 0..1080
  userId: string;
  userName: string;
  userColor: string;
  content: string;
  createdAt: number;
  resolved: boolean;
  resolvedAt?: number;
  resolvedBy?: string;
  replies: CommentReply[];
}

export type CommentAction =
  | { type: 'create'; comment: DeckComment }
  | { type: 'reply'; commentId: string; reply: CommentReply }
  | { type: 'resolve'; commentId: string; resolved: boolean; resolvedBy?: string }
  | { type: 'delete'; commentId: string }
  | { type: 'move'; commentId: string; x: number; y: number };
