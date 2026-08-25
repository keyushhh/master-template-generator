import { useEffect, useRef } from 'react';

const EMOJIS = ['👍', '🔥', '🎉', '🚀', '❤️'];

interface Props {
  x: number;
  y: number;
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function ReactionPicker({ x, y, onSelect, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (['1', '2', '3', '4', '5'].includes(e.key)) {
        const index = parseInt(e.key, 10) - 1;
        if (EMOJIS[index]) {
          onSelect(EMOJIS[index]);
          onClose();
        }
      }
    };

    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClickOutside);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClickOutside);
    };
  }, [onSelect, onClose]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        left: Math.max(10, Math.min(window.innerWidth - 200, x - 90)),
        top: Math.max(10, Math.min(window.innerHeight - 50, y - 55)),
        zIndex: 300,
        backgroundColor: '#FFFFFF',
        border: '1px solid var(--neutral-200, #E5E5E5)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        borderRadius: 0,
        padding: '4px 6px',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}
      className="animate-in fade-in zoom-in-95 duration-100"
    >
      {EMOJIS.map((emoji, idx) => (
        <button
          key={emoji}
          type="button"
          onClick={() => {
            onSelect(emoji);
            onClose();
          }}
          title={`${emoji} (Press ${idx + 1})`}
          className="w-8 h-8 flex items-center justify-center text-[18px] hover:scale-125 hover:bg-neutral-100 rounded-none transition-all cursor-pointer select-none"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
