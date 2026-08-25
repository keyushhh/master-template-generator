import React, { useEffect, useRef, useState } from 'react';
import type { DeckComment, CommentReply } from './types';
import { DEMO_USERS, initialsOf, type DemoUser } from '../auth/demoUsers';
import {
  CheckIcon,
  CloseIcon,
  MentionIcon,
  MoreHorizontalIcon,
  SendIcon,
  SmileIcon,
} from '../ui/icons';

interface CommentCardProps {
  comment?: DeckComment; // undefined when creating a new comment
  currentUser: DemoUser;
  onSaveNew?: (content: string) => void;
  onReply?: (content: string) => void;
  onToggleResolve?: () => void;
  onDelete?: () => void;
  onClose: () => void;
  position?: { x: number; y: number };
}

function timeAgo(timestamp: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  return `${Math.floor(diffHour / 24)}d ago`;
}

function formatMentions(text: string): React.ReactNode[] {
  const names = DEMO_USERS.map((u) => u.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const regex = new RegExp(`(@(?:${names}|[a-zA-Z0-9_]+))`, 'g');
  const parts = text.split(regex);
  return parts.map((part, index) => {
    if (part.startsWith('@')) {
      return (
        <span
          key={index}
          className="font-bold text-[#60A5FA] bg-blue-950/70 px-1 py-0.5 rounded text-[12px] inline-block my-0.5"
        >
          {part}
        </span>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

const QUICK_EMOJIS = ['👍', '❤️', '🔥', '👏', '🚀', '👀', '🎉', '💡'];

export function CommentCard({
  comment,
  currentUser,
  onSaveNew,
  onReply,
  onToggleResolve,
  onDelete,
  onClose,
}: CommentCardProps) {
  const [draft, setDraft] = useState('');
  const [replyText, setReplyText] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const replyInputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const isDrafting = !comment;

  useEffect(() => {
    if (isDrafting) {
      setTimeout(() => textareaRef.current?.focus(), 20);
    } else {
      setTimeout(() => replyInputRef.current?.focus(), 20);
    }
  }, [isDrafting]);

  // Click outside to close menus
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setShowMentions(false);
        setShowEmojis(false);
        setShowMenu(false);
      }
    };
    window.addEventListener('mousedown', handleGlobalClick);
    return () => window.removeEventListener('mousedown', handleGlobalClick);
  }, []);

  const handleInsertMention = (user: DemoUser) => {
    const mentionTag = `@${user.name} `;
    if (isDrafting) {
      setDraft((prev) => prev.replace(/@[a-zA-Z0-9_\s]*$/, '') + mentionTag);
      textareaRef.current?.focus();
    } else {
      setReplyText((prev) => prev.replace(/@[a-zA-Z0-9_\s]*$/, '') + mentionTag);
      replyInputRef.current?.focus();
    }
    setShowMentions(false);
  };

  const handleInsertEmoji = (emoji: string) => {
    if (isDrafting) {
      setDraft((prev) => prev + emoji);
      textareaRef.current?.focus();
    } else {
      setReplyText((prev) => prev + emoji);
      replyInputRef.current?.focus();
    }
    setShowEmojis(false);
  };

  const handleDraftSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!draft.trim() || !onSaveNew) return;
    onSaveNew(draft.trim());
    setDraft('');
  };

  const handleReplySubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!replyText.trim() || !onReply) return;
    onReply(replyText.trim());
    setReplyText('');
  };

  return (
    <div
      ref={cardRef}
      data-comment-card="true"
      onClick={(e) => e.stopPropagation()}
      style={{
        width: 320,
        backgroundColor: '#242424',
        color: '#EDEDED',
        borderRadius: 14,
        boxShadow:
          '0 20px 50px rgba(0, 0, 0, 0.6), 0 4px 16px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.1)',
        fontFamily:
          'var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
        overflow: 'hidden',
        zIndex: 250,
      }}
      className="animate-in fade-in zoom-in-95 duration-150 select-none text-left"
    >
      {/* ── Mode 1: New Draft Comment (Figma Style) ── */}
      {isDrafting ? (
        <div className="flex flex-col">
          {/* Top text area */}
          <div className="p-3.5 pb-2">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => {
                const val = e.target.value;
                setDraft(val);
                if (val.endsWith('@')) {
                  setShowMentions(true);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleDraftSubmit();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  onClose();
                }
              }}
              placeholder="Add a comment..."
              rows={3}
              style={{
                width: '100%',
                backgroundColor: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#ffffff',
                fontSize: '13.5px',
                lineHeight: '1.45',
                resize: 'none',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Mentions Picker Popup */}
          {showMentions && (
            <div
              style={{
                backgroundColor: '#1E1E1E',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                boxShadow: '0 12px 30px rgba(0, 0, 0, 0.5)',
              }}
              className="mx-3 mb-2 rounded-lg p-1 flex flex-col gap-0.5"
            >
              <div className="px-2 py-1 text-[10px] font-bold tracking-wider uppercase text-neutral-400">
                Mention team member
              </div>
              {DEMO_USERS.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => handleInsertMention(u)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-neutral-800 text-left transition-colors cursor-pointer"
                >
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                    style={{ backgroundColor: u.color }}
                  >
                    {initialsOf(u.name)}
                  </span>
                  <span className="text-[12.5px] font-semibold text-neutral-200 truncate">
                    {u.name}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Quick Emoji Picker */}
          {showEmojis && (
            <div
              style={{
                backgroundColor: '#1E1E1E',
                border: '1px solid rgba(255, 255, 255, 0.12)',
              }}
              className="mx-3 mb-2 rounded-lg p-2 flex flex-wrap gap-1.5 justify-center"
            >
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleInsertEmoji(emoji)}
                  className="w-7 h-7 text-[16px] flex items-center justify-center hover:bg-neutral-800 rounded transition-transform hover:scale-110 cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          {/* Bottom toolbar */}
          <div className="p-2.5 pt-1.5 border-t border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setShowEmojis((v) => !v);
                  setShowMentions(false);
                }}
                title="Add emoji"
                className="w-7 h-7 flex items-center justify-center text-neutral-400 hover:text-white rounded hover:bg-white/10 transition-colors cursor-pointer"
              >
                <SmileIcon size={16} />
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowMentions((v) => !v);
                  setShowEmojis(false);
                }}
                title="Mention someone (@)"
                className="w-7 h-7 flex items-center justify-center text-neutral-400 hover:text-white rounded hover:bg-white/10 transition-colors cursor-pointer"
              >
                <MentionIcon size={16} />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-2.5 py-1 text-[12px] font-semibold text-neutral-400 hover:text-white rounded transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => handleDraftSubmit()}
                disabled={!draft.trim()}
                title="Post comment (Cmd+Enter)"
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                  draft.trim()
                    ? 'bg-[#0D99FF] text-white shadow-md hover:bg-blue-500'
                    : 'bg-neutral-800 text-neutral-600 cursor-not-allowed'
                }`}
              >
                <SendIcon size={14} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ── Mode 2: Existing Comment Thread (Figma Style) ── */
        <div className="flex flex-col">
          {/* Header */}
          <div className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[12.5px] font-bold text-white tracking-wide">
                Comment
              </span>
              {comment.resolved && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                  Resolved
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {/* More options menu */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowMenu((v) => !v)}
                  title="More actions"
                  className="w-6 h-6 flex items-center justify-center text-neutral-400 hover:text-white rounded hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <MoreHorizontalIcon size={15} />
                </button>

                {showMenu && (
                  <div
                    style={{
                      backgroundColor: '#1E1E1E',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
                    }}
                    className="absolute right-0 top-full mt-1 w-36 rounded-lg p-1 z-50 flex flex-col"
                  >
                    {onDelete && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowMenu(false);
                          onDelete();
                        }}
                        className="w-full px-2.5 py-1.5 text-[12px] font-medium text-red-400 hover:bg-red-950/40 rounded text-left transition-colors cursor-pointer"
                      >
                        Delete comment
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Mark as Resolved button */}
              {onToggleResolve && (
                <button
                  type="button"
                  onClick={onToggleResolve}
                  title={comment.resolved ? 'Reopen comment' : 'Mark as resolved'}
                  className={`w-6 h-6 flex items-center justify-center rounded transition-colors cursor-pointer ${
                    comment.resolved
                      ? 'text-emerald-400 bg-emerald-950/50 hover:bg-emerald-900/50'
                      : 'text-neutral-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <CheckIcon size={14} />
                </button>
              )}

              {/* Close */}
              <button
                type="button"
                onClick={onClose}
                title="Close"
                className="w-6 h-6 flex items-center justify-center text-neutral-400 hover:text-white rounded hover:bg-white/10 transition-colors cursor-pointer"
              >
                <CloseIcon size={14} />
              </button>
            </div>
          </div>

          {/* Comments and Replies Scroll Area */}
          <div className="max-h-[340px] overflow-y-auto p-4 flex flex-col gap-3.5">
            {/* Primary / OP comment */}
            <div className="flex items-start gap-2.5">
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center text-[10.5px] font-bold text-white select-none shrink-0 shadow-sm"
                style={{ backgroundColor: comment.userColor }}
              >
                {initialsOf(comment.userName)}
              </span>

              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="text-[13px] font-bold text-white truncate">
                    {comment.userName}
                  </span>
                  <span className="text-[11px] text-neutral-400">
                    {timeAgo(comment.createdAt)}
                  </span>
                </div>
                <div className="text-[13px] text-neutral-200 leading-relaxed break-words">
                  {formatMentions(comment.content)}
                </div>
              </div>
            </div>

            {/* Replies List */}
            {comment.replies && comment.replies.length > 0 && (
              <div className="flex flex-col gap-3 pt-2 pl-3 border-l border-white/10 ml-3.5">
                {comment.replies.map((reply: CommentReply) => (
                  <div key={reply.id} className="flex items-start gap-2.5">
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[9.5px] font-bold text-white select-none shrink-0 shadow-sm"
                      style={{ backgroundColor: reply.userColor }}
                    >
                      {initialsOf(reply.userName)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="text-[12px] font-bold text-white truncate">
                          {reply.userName}
                        </span>
                        <span className="text-[10.5px] text-neutral-400">
                          {timeAgo(reply.createdAt)}
                        </span>
                      </div>
                      <div className="text-[12.5px] text-neutral-200 leading-relaxed break-words">
                        {formatMentions(reply.content)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reply Input Form */}
          {onReply && !comment.resolved && (
            <div className="p-3 border-t border-white/10 bg-neutral-900/80 rounded-b-[14px]">
              {showMentions && (
                <div
                  style={{
                    backgroundColor: '#1E1E1E',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                  }}
                  className="mb-2 rounded-lg p-1 flex flex-col gap-0.5 shadow-xl"
                >
                  <div className="px-2 py-0.5 text-[9.5px] font-bold tracking-wider uppercase text-neutral-400">
                    Mention team member
                  </div>
                  {DEMO_USERS.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleInsertMention(u)}
                      className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-neutral-800 text-left transition-colors cursor-pointer"
                    >
                      <span
                        className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0"
                        style={{ backgroundColor: u.color }}
                      >
                        {initialsOf(u.name)}
                      </span>
                      <span className="text-[12px] font-semibold text-neutral-200 truncate">
                        {u.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <form
                onSubmit={handleReplySubmit}
                className="flex items-center gap-2 bg-[#1A1A1A] border border-white/10 rounded-full px-3 py-1.5 focus-within:border-[#0D99FF] transition-colors"
              >
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[8.5px] font-bold text-white shrink-0"
                  style={{ backgroundColor: currentUser.color }}
                >
                  {initialsOf(currentUser.name)}
                </span>

                <input
                  ref={replyInputRef}
                  type="text"
                  value={replyText}
                  onChange={(e) => {
                    const val = e.target.value;
                    setReplyText(val);
                    if (val.endsWith('@')) setShowMentions(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') onClose();
                  }}
                  placeholder="Reply..."
                  className="w-full bg-transparent text-[12.5px] text-white placeholder-neutral-500 outline-none"
                />

                <button
                  type="button"
                  onClick={() => setShowMentions((v) => !v)}
                  title="Mention someone (@)"
                  className="text-neutral-400 hover:text-white p-0.5 transition-colors cursor-pointer"
                >
                  <MentionIcon size={14} />
                </button>

                <button
                  type="submit"
                  disabled={!replyText.trim()}
                  title="Send reply"
                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                    replyText.trim()
                      ? 'bg-[#0D99FF] text-white hover:bg-blue-500'
                      : 'bg-neutral-800 text-neutral-600 cursor-not-allowed'
                  }`}
                >
                  <SendIcon size={12} />
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
