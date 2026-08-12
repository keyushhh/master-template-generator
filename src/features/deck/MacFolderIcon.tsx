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
    <div className={`relative shrink-0 ${dims} select-none flex items-center justify-center ${className}`}>
      {/* Base Resting SVG */}
      <img
        src={defaultSrc}
        alt="Folder"
        className={`absolute inset-0 w-full h-full object-contain transition-all duration-300 ease-out ${
          isHovered ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
        }`}
        style={{ filter }}
      />
      {/* Hover Animated SVG */}
      <img
        src={hoverSrc}
        alt="Folder Open"
        className={`absolute inset-0 w-full h-full object-contain transition-all duration-300 ease-out ${
          isHovered ? 'opacity-100 scale-105' : 'opacity-0 scale-95'
        }`}
        style={{ filter }}
      />
    </div>
  );
}
