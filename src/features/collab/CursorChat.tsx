import React, { useEffect, useRef, useState } from 'react';

interface CursorChatProps {
  active: boolean;
  onClose: () => void;
  onTextChange: (text: string | undefined) => void;
  userColor?: string;
  userName?: string;
}

const CHAT_DURATION_MS = 14_000;

export function CursorChat({
  active,
  onClose,
  onTextChange,
  userColor = '#7C3AED',
}: CursorChatProps) {
  const [text, setText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const autoClearTimerRef = useRef<number | null>(null);
  const posRef = useRef({ x: -1000, y: -1000 });

  // Ultra-smooth 60fps/120fps direct hardware-accelerated tracking
  useEffect(() => {
    let animFrame: number;
    const onMove = (e: MouseEvent) => {
      posRef.current = { x: e.clientX, y: e.clientY };
      if (!animFrame) {
        animFrame = requestAnimationFrame(() => {
          if (containerRef.current) {
            containerRef.current.style.transform = `translate3d(${posRef.current.x + 12}px, ${posRef.current.y + 8}px, 0)`;
          }
          animFrame = 0;
        });
      }
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      if (animFrame) cancelAnimationFrame(animFrame);
    };
  }, []);

  // When activated, focus input immediately
  useEffect(() => {
    if (active) {
      setIsTyping(true);
      setText('');
      onTextChange(undefined);
      if (autoClearTimerRef.current) clearTimeout(autoClearTimerRef.current);
      // Position at current pointer immediately if known
      if (containerRef.current && posRef.current.x > 0) {
        containerRef.current.style.transform = `translate3d(${posRef.current.x + 12}px, ${posRef.current.y + 8}px, 0)`;
      }
      setTimeout(() => {
        inputRef.current?.focus();
      }, 10);
    }
  }, [active, onTextChange]);

  const scheduleAutoClear = () => {
    if (autoClearTimerRef.current) clearTimeout(autoClearTimerRef.current);
    autoClearTimerRef.current = window.setTimeout(() => {
      setText('');
      onTextChange(undefined);
      setIsTyping(false);
      onClose();
    }, CHAT_DURATION_MS);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setIsTyping(false);
      scheduleAutoClear();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setText('');
      onTextChange(undefined);
      setIsTyping(false);
      onClose();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setText(val);
    onTextChange(val.trim() ? val : undefined);
    if (val.trim()) {
      scheduleAutoClear();
    }
  };

  if (!active && !text) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        transform: `translate3d(${posRef.current.x + 12}px, ${posRef.current.y + 8}px, 0)`,
        pointerEvents: isTyping ? 'auto' : 'none',
        zIndex: 9999,
        willChange: 'transform',
      }}
    >
      {/* Sleek pill bubble in user's distinct color */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '7px 15px',
          borderRadius: '4px 18px 18px 18px',
          backgroundColor: userColor,
          border: '1.5px solid rgba(255, 255, 255, 0.3)',
          boxShadow: '0 8px 28px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.2)',
          fontFamily: 'var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
          fontSize: '13px',
          fontWeight: 600,
          lineHeight: '1.3',
          maxWidth: '340px',
          minWidth: '130px',
          color: '#FFFFFF',
        }}
      >
        {isTyping ? (
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              if (!text.trim()) {
                onClose();
              } else {
                setIsTyping(false);
                scheduleAutoClear();
              }
            }}
            placeholder="Say something..."
            maxLength={120}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 600,
              width: '100%',
              minWidth: '120px',
              fontFamily: 'inherit',
            }}
          />
        ) : (
          <span
            onClick={() => {
              setIsTyping(true);
              setTimeout(() => inputRef.current?.focus(), 10);
            }}
            style={{
              wordBreak: 'break-word',
              cursor: 'text',
              pointerEvents: 'auto',
            }}
          >
            {text}
          </span>
        )}
      </div>
    </div>
  );
}
