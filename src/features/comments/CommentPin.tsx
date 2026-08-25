import React, { useRef, useState } from 'react';
import { initialsOf } from '../auth/demoUsers';
import type { DeckComment } from './types';

interface CommentPinProps {
  comment: DeckComment;
  selected: boolean;
  scale: number;
  slideRect: DOMRect | null;
  onClick: (e: React.MouseEvent) => void;
  onMove: (commentId: string, x: number, y: number) => void;
}

export function CommentPin({
  comment,
  selected,
  scale,
  slideRect,
  onClick,
  onMove,
}: CommentPinProps) {
  const initials = initialsOf(comment.userName);
  const repliesCount = comment.replies?.length ?? 0;
  const [isDragging, setIsDragging] = useState(false);

  const startPointerRef = useRef<{ x: number; y: number } | null>(null);
  const startCommentRef = useRef<{ x: number; y: number } | null>(null);
  const hasDraggedRef = useRef(false);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (e.button !== 0) return; // Only left click drag
    startPointerRef.current = { x: e.clientX, y: e.clientY };
    startCommentRef.current = { x: comment.x, y: comment.y };
    hasDraggedRef.current = false;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!startPointerRef.current || !startCommentRef.current || !slideRect || scale <= 0) return;
    const dx = e.clientX - startPointerRef.current.x;
    const dy = e.clientY - startPointerRef.current.y;

    if (!hasDraggedRef.current && Math.hypot(dx, dy) > 4) {
      hasDraggedRef.current = true;
      setIsDragging(true);
    }

    if (hasDraggedRef.current) {
      const newX = Math.max(10, Math.min(1910, Math.round(startCommentRef.current.x + dx / scale)));
      const newY = Math.max(10, Math.min(1070, Math.round(startCommentRef.current.y + dy / scale)));
      onMove(comment.id, newX, newY);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (startPointerRef.current) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch {
        // ignore
      }
      startPointerRef.current = null;
      startCommentRef.current = null;

      if (hasDraggedRef.current) {
        setIsDragging(false);
        hasDraggedRef.current = false;
      } else {
        onClick(e);
      }
    }
  };

  return (
    <button
      type="button"
      data-comment-pin="true"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        startPointerRef.current = null;
        startCommentRef.current = null;
        setIsDragging(false);
        hasDraggedRef.current = false;
      }}
      title={`Comment by ${comment.userName} (Click to view, drag to move)`}
      aria-label={`Comment by ${comment.userName}`}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: isDragging ? 'grabbing' : 'grab',
        border: 'none',
        background: 'transparent',
        padding: 0,
        outline: 'none',
        touchAction: 'none',
        transform: 'translate(-8px, -24px)', // Pin tip lands at (x, y)
        filter: selected || isDragging
          ? 'drop-shadow(0 6px 14px rgba(13, 153, 255, 0.45))'
          : 'drop-shadow(0 4px 10px rgba(0, 0, 0, 0.35))',
        zIndex: isDragging ? 300 : undefined,
      }}
      className="group hover:scale-105 select-none"
    >
      {/* Teardrop Pin Container in User Color */}
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: '50% 50% 50% 4px',
          transform: 'rotate(-45deg)',
          backgroundColor: comment.resolved ? '#64748B' : (comment.userColor || '#7C3AED'),
          border: selected || isDragging ? '2.5px solid #0D99FF' : '2px solid #FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: selected || isDragging
            ? '0 0 0 2px #0D99FF, 0 6px 16px rgba(0,0,0,0.35)'
            : '0 4px 12px rgba(0,0,0,0.3)',
          overflow: 'hidden',
          transition: isDragging ? 'none' : 'border-color 0.15s, transform 0.15s, box-shadow 0.15s',
        }}
      >
        {/* Counter-rotate inner text to stay upright */}
        <span
          style={{
            transform: 'rotate(45deg)',
            color: '#FFFFFF',
            fontSize: '11px',
            fontWeight: 800,
            fontFamily: 'var(--font-mono, monospace)',
            userSelect: 'none',
            lineHeight: 1,
            pointerEvents: 'none',
          }}
        >
          {initials}
        </span>
      </div>

      {/* Reply count badge if replies exist */}
      {repliesCount > 0 && (
        <span
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            minWidth: 16,
            height: 16,
            padding: '0 4px',
            borderRadius: 8,
            backgroundColor: '#0D99FF',
            color: '#fff',
            fontSize: '9.5px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 5px rgba(0, 0, 0, 0.25)',
            border: '1.5px solid #fff',
            pointerEvents: 'none',
          }}
        >
          {repliesCount}
        </span>
      )}
    </button>
  );
}
