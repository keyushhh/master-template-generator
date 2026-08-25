import { useEffect, useRef, useState } from 'react';
import type { DeckComment } from './types';
import { initialsOf, type DemoUser } from '../auth/demoUsers';
import { CommentPin } from './CommentPin';
import { CommentCard } from './CommentCard';

interface CommentsLayerProps {
  slideId: string | null;
  comments: DeckComment[];
  activeCommentId: string | null;
  draftPosition: { x: number; y: number } | null;
  isCommentMode: boolean;
  onExitCommentMode: () => void;
  showComments: boolean;
  showResolved: boolean;
  currentUser: DemoUser;
  onSelectComment: (commentId: string | null) => void;
  onDraftPositionChange: (pos: { x: number; y: number } | null) => void;
  onSaveComment: (slideId: string, x: number, y: number, content: string) => void;
  onReplyComment: (commentId: string, content: string) => void;
  onToggleResolveComment: (commentId: string) => void;
  onDeleteComment: (commentId: string) => void;
  onMoveComment: (commentId: string, x: number, y: number) => void;
}

const SLIDE_W = 1920;
const SLIDE_H = 1080;

export function CommentsLayer({
  slideId,
  comments,
  activeCommentId,
  draftPosition,
  isCommentMode,
  onExitCommentMode,
  showComments,
  showResolved,
  currentUser,
  onSelectComment,
  onDraftPositionChange,
  onSaveComment,
  onReplyComment,
  onToggleResolveComment,
  onDeleteComment,
  onMoveComment,
}: CommentsLayerProps) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const hoverPinRef = useRef<HTMLDivElement>(null);
  const [mouseInsideSlide, setMouseInsideSlide] = useState(false);

  useEffect(() => {
    const measure = () => {
      const stage = document.querySelector<HTMLElement>('[data-slide]');
      setRect(stage?.getBoundingClientRect() ?? null);
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [slideId, comments.length]);

  // Smooth floating preview pin following cursor when in comment mode
  useEffect(() => {
    if (!isCommentMode) {
      setMouseInsideSlide(false);
      return;
    }

    let animFrame: number;
    const onMove = (e: MouseEvent) => {
      const stage = document.querySelector<HTMLElement>('[data-slide]');
      const stageRect = stage?.getBoundingClientRect();
      if (!stageRect) {
        setMouseInsideSlide(false);
        return;
      }

      const inside =
        e.clientX >= stageRect.left &&
        e.clientX <= stageRect.right &&
        e.clientY >= stageRect.top &&
        e.clientY <= stageRect.bottom;

      setMouseInsideSlide(inside);

      if (inside) {
        if (!animFrame) {
          animFrame = requestAnimationFrame(() => {
            if (hoverPinRef.current) {
              hoverPinRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
            }
            animFrame = 0;
          });
        }
      }
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      if (animFrame) cancelAnimationFrame(animFrame);
    };
  }, [isCommentMode]);

  // Click outside to dismiss active comment card or draft card
  useEffect(() => {
    if (!activeCommentId && !draftPosition) return;
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-comment-card], [data-comment-pin]')) {
        return;
      }
      onSelectComment(null);
      onDraftPositionChange(null);
    };
    window.addEventListener('mousedown', handleGlobalClick);
    return () => window.removeEventListener('mousedown', handleGlobalClick);
  }, [activeCommentId, draftPosition, onSelectComment, onDraftPositionChange]);

  if (!rect || rect.width <= 0 || !slideId) return null;

  const scale = rect.width / SLIDE_W;

  // Filter comments for this slide
  const slideComments = comments.filter((c) => {
    if (c.slideId !== slideId) return false;
    if (!showResolved && c.resolved) return false;
    return true;
  });

  return (
    <>
      {/* ── Comment Placement Click Target on Slide ── */}
      {isCommentMode && (
        <div
          style={{
            position: 'fixed',
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            zIndex: 105,
            cursor: 'crosshair',
          }}
          onClick={(e) => {
            e.stopPropagation();
            const currentScale = rect.width / SLIDE_W;
            const x = Math.max(0, Math.min(SLIDE_W, (e.clientX - rect.left) / currentScale));
            const y = Math.max(0, Math.min(SLIDE_H, (e.clientY - rect.top) / currentScale));
            onDraftPositionChange({ x, y });
            onExitCommentMode();
            onSelectComment(null);
          }}
        />
      )}

      {/* ── Floating Cursor Preview Pin in Comment Mode (Figma style) ── */}
      {isCommentMode && mouseInsideSlide && (
        <div
          ref={hoverPinRef}
          style={{
            position: 'fixed',
            left: 0,
            top: 0,
            pointerEvents: 'none',
            zIndex: 108,
            willChange: 'transform',
          }}
        >
          <div
            style={{
              position: 'relative',
              display: 'inline-flex',
              transform: 'translate(-8px, -24px)',
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50% 50% 50% 4px',
                transform: 'rotate(-45deg)',
                backgroundColor: currentUser.color,
                border: '2px solid #FFFFFF',
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span
                style={{
                  transform: 'rotate(45deg)',
                  fontSize: '9.5px',
                  fontWeight: 800,
                  color: '#FFFFFF',
                  fontFamily: 'var(--font-mono, monospace)',
                }}
              >
                {initialsOf(currentUser.name)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Fixed Layer for Pins and Cards ── */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 106,
        }}
      >
        {/* ── Render Comment Pins on Current Slide ── */}
        {showComments &&
          slideComments.map((c) => {
            const isSelected = c.id === activeCommentId;
            const pinLeft = rect.left + c.x * scale;
            const pinTop = rect.top + c.y * scale;

            return (
              <div
                key={c.id}
                style={{
                  position: 'absolute',
                  left: pinLeft,
                  top: pinTop,
                  pointerEvents: 'auto',
                  zIndex: isSelected ? 150 : 130,
                }}
              >
                <CommentPin
                  comment={c}
                  selected={isSelected}
                  scale={scale}
                  slideRect={rect}
                  onMove={onMoveComment}
                  onClick={() => {
                    onDraftPositionChange(null);
                    onSelectComment(isSelected ? null : c.id);
                  }}
                />

                {/* Active comment card popover beside pin */}
                {isSelected && (
                  <div
                    style={{
                      position: 'absolute',
                      left: 20,
                      top: -10,
                      zIndex: 200,
                    }}
                  >
                    <CommentCard
                      comment={c}
                      currentUser={currentUser}
                      onReply={(text) => onReplyComment(c.id, text)}
                      onToggleResolve={() => onToggleResolveComment(c.id)}
                      onDelete={() => {
                        onDeleteComment(c.id);
                        onSelectComment(null);
                      }}
                      onClose={() => onSelectComment(null)}
                    />
                  </div>
                )}
              </div>
            );
          })}

        {/* ── Render Draft Comment Pin and Card (when creating new comment) ── */}
        {showComments && draftPosition && (
          <div
            style={{
              position: 'absolute',
              left: rect.left + draftPosition.x * scale,
              top: rect.top + draftPosition.y * scale,
              pointerEvents: 'auto',
              zIndex: 200,
            }}
          >
            {/* Draft pin */}
            <div
              data-comment-pin="true"
              style={{
                position: 'relative',
                display: 'inline-flex',
                transform: 'translate(-8px, -24px)',
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50% 50% 50% 4px',
                  transform: 'rotate(-45deg)',
                  backgroundColor: currentUser.color,
                  border: '2.5px solid #0D99FF',
                  boxShadow: '0 0 0 2px #0D99FF, 0 6px 16px rgba(0,0,0,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span
                  style={{
                    transform: 'rotate(45deg)',
                    fontSize: '11px',
                    fontWeight: 800,
                    color: '#FFFFFF',
                    fontFamily: 'var(--font-mono, monospace)',
                  }}
                >
                  {initialsOf(currentUser.name)}
                </span>
              </div>
            </div>

            {/* Draft Comment Card */}
            <div
              style={{
                position: 'absolute',
                left: 20,
                top: -10,
                zIndex: 200,
              }}
            >
              <CommentCard
                currentUser={currentUser}
                onSaveNew={(text) => {
                  onSaveComment(slideId, draftPosition.x, draftPosition.y, text);
                  onDraftPositionChange(null);
                }}
                onClose={() => onDraftPositionChange(null)}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
