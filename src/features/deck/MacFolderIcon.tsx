import type { FolderColor } from './deckStore';
import folderEmptyBack from '../../assets/folder-empty-back.svg';
import folderEmptyFlap from '../../assets/folder-empty-flap.svg';
import folderEmptyBadge from '../../assets/folder-empty-badge.svg';
import folderFilledBack from '../../assets/folder-filled-back.svg';
import folderFilledPapers from '../../assets/folder-filled-papers.svg';
import folderFilledFlap from '../../assets/folder-filled-flap.svg';
import folderFilledBadge from '../../assets/folder-filled-badge.svg';

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

/** Figma's transition on this interaction: smart animate, linear, 300ms. */
const TRANSITION = 'transform 300ms linear';

/** The flap in the hover frame is the resting flap squashed to 82/110.01 of its
 *  height with its bottom edge pinned, measured off the two Figma exports. */
const FLAP_OPEN_SCALE = 0.7454;

/** The papers ride 2.68 units (of the 161-unit canvas) higher once it opens. */
const PAPERS_LIFT = '-1.66%';

/**
 * High-fidelity SVG macOS folder icon. Hovering replays the Figma interaction:
 * the front flap drops open while the papers inside lift, linearly over 300ms,
 * the same layer-for-layer interpolation smart animate does, rather than a
 * cross-fade between two flattened states.
 */
export function MacFolderIcon({
  color = 'blue',
  isEmpty = false,
  isHovered = false,
  className = '',
  size = 'md',
  sizePx,
}: MacFolderIconProps) {
  const filter = COLOR_FILTERS[color] ?? COLOR_FILTERS.blue;

  const dims = {
    sm: 'w-14 h-14',
    md: 'w-24 h-24 sm:w-28 sm:h-28',
    lg: 'w-32 h-32',
  }[size];

  const layer = 'absolute inset-0 w-full h-full object-contain';
  const back = isEmpty ? folderEmptyBack : folderFilledBack;
  const flap = isEmpty ? folderEmptyFlap : folderFilledFlap;
  const badge = isEmpty ? folderEmptyBadge : folderFilledBadge;

  return (
    <div
      className={`relative shrink-0 ${sizePx ? '' : dims} select-none flex items-center justify-center isolate ${className}`}
      style={sizePx ? { width: sizePx, height: sizePx } : undefined}
    >
      {/* Back panel, fixed in both frames. */}
      <img src={back} alt="Folder" className={layer} style={{ filter }} />

      {/* Papers, lifting a hair as the flap clears them. */}
      {!isEmpty && (
        <img
          src={folderFilledPapers}
          alt=""
          aria-hidden
          className={layer}
          style={{
            filter,
            transform: isHovered ? `translateY(${PAPERS_LIFT})` : 'none',
            transition: TRANSITION,
          }}
        />
      )}

      {/* Front flap, squashed from its bottom edge, which is what Figma's
          resize interpolation between the two frames amounts to. */}
      <img
        src={flap}
        alt=""
        aria-hidden
        className={layer}
        style={{
          filter,
          transformOrigin: '50% 100%',
          transform: isHovered ? `scaleY(${FLAP_OPEN_SCALE})` : 'scaleY(1)',
          transition: TRANSITION,
        }}
      />

      {/* Multiply-blended badge sitting on the flap, fixed in both frames. */}
      <img
        src={badge}
        alt=""
        aria-hidden
        className={layer}
        style={{ filter, mixBlendMode: 'multiply' }}
      />
    </div>
  );
}
