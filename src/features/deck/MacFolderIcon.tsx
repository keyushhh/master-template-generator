import type { FolderColor } from './deckStore';
import folderEmpty from '../../assets/folder-empty.svg';
import folderFilled from '../../assets/folder-filled.svg';
import folderEmptyHover from '../../assets/folder-empty-hover.svg';
import folderFilledHover from '../../assets/folder-filled-hover.svg';

interface MacFolderIconProps {
  color?: FolderColor;
  isEmpty?: boolean;
  isHovered?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  /** An exact pixel size, for continuous zoom rather than the three fixed
   *  steps. Takes over from `size` when given. */
  sizePx?: number;
}

/** Hue & color filters applied to the high-res SVG assets */
const COLOR_FILTERS: Record<FolderColor, string> = {
  blue: 'none',
  purple: 'hue-rotate(45deg)',
  indigo: 'hue-rotate(20deg)',
  rose: 'hue-rotate(120deg) saturate(1.1)',
  orange: 'hue-rotate(160deg) saturate(1.3)',
  amber: 'hue-rotate(185deg) saturate(1.4)',
  emerald: 'hue-rotate(240deg) saturate(1.2)',
  slate: 'grayscale(0.85) brightness(0.85)',
};

/**
 * High-fidelity SVG macOS Folder Icon with silky-smooth cross-fade hover state transition
 * and dynamic color swapping.
 */
export function MacFolderIcon({
  color = 'blue',
  isEmpty = false,
  isHovered = false,
  className = '',
  size = 'md',
  sizePx,
}: MacFolderIconProps) {
  const defaultSrc = isEmpty ? folderEmpty : folderFilled;
  const hoverSrc = isEmpty ? folderEmptyHover : folderFilledHover;
  const filter = COLOR_FILTERS[color] ?? COLOR_FILTERS.blue;

  const dims = {
    sm: 'w-14 h-14',
    md: 'w-24 h-24 sm:w-28 sm:h-28',
    lg: 'w-32 h-32',
  }[size];

  return (
    <div
      className={`relative shrink-0 ${sizePx ? '' : dims} select-none flex items-center justify-center ${className}`}
      style={sizePx ? { width: sizePx, height: sizePx } : undefined}
    >
      {/* Base Resting SVG. Linear pacing, and the open state trails it by a
          beat, so it still reads as one thing leaving before the other
          arrives rather than a flat simultaneous crossfade. */}
      <img
        src={defaultSrc}
        alt="Folder"
        className={`absolute inset-0 w-full h-full object-contain ${
          isHovered ? 'opacity-0 scale-[0.97] -translate-y-[1.5%]' : 'opacity-100 scale-100 translate-y-0'
        }`}
        style={{ filter, transition: 'opacity 260ms linear, transform 260ms linear' }}
      />
      {/* Hover Animated SVG - rises in a touch after the resting one starts leaving. */}
      <img
        src={hoverSrc}
        alt="Folder Open"
        className={`absolute inset-0 w-full h-full object-contain ${
          isHovered ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-[0.94] translate-y-[2%]'
        }`}
        style={{
          filter,
          transition: 'opacity 460ms linear 40ms, transform 460ms linear 40ms',
        }}
      />
    </div>
  );
}
