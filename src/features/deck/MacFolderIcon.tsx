import { useId, useState } from 'react';
import { motion } from 'motion/react';
import type { FolderColor } from './deckStore';

interface MacFolderIconProps {
  color?: FolderColor;
  isEmpty?: boolean;
  /** Left off, the folder tracks its own hover. Pass it to drive the folder
   *  from a larger target, such as the whole card in the folder grid. */
  isHovered?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  /** An exact pixel size, for continuous zoom rather than the three fixed
   *  steps. Takes over from `size` when given. */
  sizePx?: number;
}

const BASE_WIDTH = 321;
const BASE_HEIGHT = 270;

const FLAP_PATH =
  'M0 25C0 11.1929 11.1929 0 25 0H136.084C143.044 0 149.689 2.90139 154.42 8.00608L178.08 33.5343C182.811 38.639 189.456 41.5404 196.416 41.5404H296C309.807 41.5404 321 52.7333 321 66.5404V216C321 229.807 309.807 241 296 241H25C11.1929 241 0 229.807 0 216V25Z';
const FLAP_STROKE_PATH =
  'M25 0.5H136.084C142.905 0.5 149.417 3.3431 154.054 8.3457L177.713 33.874C182.539 39.0808 189.317 42.04 196.416 42.04H296C309.531 42.04 320.5 53.0092 320.5 66.54V216C320.5 229.531 309.531 240.5 296 240.5H25C11.469 240.5 0.5 229.531 0.5 216V25C0.5 11.469 11.469 0.5 25 0.5Z';

interface Theme {
  backFill: string;
  backInsetShadow: string;
  flapFill: string;
  flapFillOpacity: number;
  flapStroke: string;
  flapInsetColor: string;
  cardFill: string;
  cardStroke: string;
  cardLineFill: string;
  cardInsetColor: string;
}

/** This app's own folder color hexes (shared with FolderChip, FolderModal, DeckTable swatches). */
const FOLDER_COLOR_HEX: Record<FolderColor, string> = {
  blue: '#3b82f6',
  purple: '#a855f7',
  indigo: '#6366f1',
  rose: '#f43f5e',
  orange: '#f97316',
  amber: '#f59e0b',
  emerald: '#10b981',
  slate: '#64748b',
};

/** Blends a hex color toward black (target 0) or white (target 255). */
function mix(hex: string, target: number, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const channel = (shift: number) => {
    const c = (n >> shift) & 255;
    return Math.round(c + (target - c) * amount).toString(16).padStart(2, '0');
  };
  return `#${channel(16)}${channel(8)}${channel(0)}`;
}

/** Same theme shape as the reference folder (flap a shade darker than the back,
 *  stroke a shade lighter), built from this app's folder colors. */
function makeTheme(hex: string): Theme {
  return {
    backFill: hex,
    backInsetShadow: 'inset 0 0 6px 2px rgba(255,255,255,0.35)',
    flapFill: mix(hex, 0, 0.18),
    flapFillOpacity: 0.45,
    flapStroke: mix(hex, 255, 0.28),
    flapInsetColor: '0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.12 0',
    cardFill: '#F1F1F1',
    cardStroke: '#E0E0E0',
    cardLineFill: '#D4D4D4',
    cardInsetColor: '0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0',
  };
}

const THEMES = Object.fromEntries(
  (Object.entries(FOLDER_COLOR_HEX) as [FolderColor, string][]).map(([name, hex]) => [name, makeTheme(hex)]),
) as Record<FolderColor, Theme>;

const SIZE_PX = { sm: 56, md: 104, lg: 128 } as const;

/** Cards lift right out of the folder on hover, each springing with its own
 *  delay. These are the reference folder's open-state values. */
const CARDS = [
  { restX: 40, hoverX: 70, restY: -10, hoverY: -160, restRotate: 10, hoverRotate: 18, delay: 0.1 },
  { restX: 3, hoverX: 0, restY: -20, hoverY: -180, restRotate: 2, hoverRotate: -3, delay: 0.05 },
  { restX: -40, hoverX: -65, restY: -22, hoverY: -170, restRotate: -5, hoverRotate: -14, delay: 0 },
];

const FLAP_TILT_REST = -15;
const FLAP_TILT_HOVER = -55;

/**
 * Folder icon whose cards fan out and whose flap tilts open on a 3D hinge on
 * hover, springing back on mouse leave. Structure and motion are ported from
 * the rareUI folder component; only the colors are this app's own.
 */
export function MacFolderIcon({
  color = 'blue',
  isEmpty = false,
  isHovered,
  className = '',
  size = 'md',
  sizePx,
}: MacFolderIconProps) {
  const [selfHovered, setSelfHovered] = useState(false);
  const hovered = isHovered ?? selfHovered;
  const theme = THEMES[color] ?? THEMES.blue;
  const containerPx = sizePx ?? SIZE_PX[size];
  const scale = containerPx / BASE_WIDTH;
  const uid = useId();
  const filterId = `folder-flap-inset-${uid}`;

  return (
    <div
      className={`relative shrink-0 select-none flex items-center justify-center ${className}`}
      style={{ width: containerPx, height: containerPx * (BASE_HEIGHT / BASE_WIDTH) }}
      onMouseEnter={isHovered === undefined ? () => setSelfHovered(true) : undefined}
      onMouseLeave={isHovered === undefined ? () => setSelfHovered(false) : undefined}
    >
      <div
        className="absolute top-1/2 left-1/2"
        style={{
          width: BASE_WIDTH,
          height: BASE_HEIGHT,
          transform: `translate(-50%, -50%) scale(${scale})`,
          // Children are in unscaled 321px space, so the perspective must not
          // be scaled with the folder or short depths project past the camera.
          perspective: 800,
        }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div
            style={{
              width: BASE_WIDTH,
              height: BASE_HEIGHT,
              borderRadius: 25,
              backgroundColor: theme.backFill,
              boxShadow: theme.backInsetShadow,
            }}
          />
        </div>

        {!isEmpty && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
            {CARDS.map((card, i) => (
              <motion.div
                key={i}
                className="absolute"
                initial={false}
                animate={{
                  y: hovered ? card.hoverY : card.restY,
                  x: hovered ? card.hoverX : card.restX,
                  rotate: hovered ? card.hoverRotate : card.restRotate,
                }}
                transition={{
                  type: 'spring',
                  stiffness: 120,
                  damping: 13,
                  delay: hovered ? card.delay : 0,
                }}
              >
                <Card filterId={`${uid}-card-${i}`} theme={theme} />
              </motion.div>
            ))}
          </div>
        )}

        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-4"
          style={{
            transformOrigin: 'bottom center',
            transformStyle: 'preserve-3d',
            width: 321,
            height: 241,
          }}
          initial={false}
          animate={{ rotateX: hovered ? FLAP_TILT_HOVER : FLAP_TILT_REST }}
          transition={{ type: 'spring', stiffness: 120, damping: 14 }}
        >
          <div
            className="absolute inset-0"
            style={{
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              clipPath: `path('${FLAP_PATH}')`,
              WebkitClipPath: `path('${FLAP_PATH}')`,
              transform: 'translateZ(0)',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              willChange: 'transform',
            }}
          />
          <svg
            className="absolute inset-0"
            width="321"
            height="241"
            viewBox="0 0 321 241"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <g filter={`url(#${filterId})`}>
              <path d={FLAP_PATH} fill={theme.flapFill} fillOpacity={theme.flapFillOpacity} />
              <path d={FLAP_STROKE_PATH} stroke={theme.flapStroke} />
            </g>
            <defs>
              <filter
                id={filterId}
                x="-25.4"
                y="-25.4"
                width="371.8"
                height="291.8"
                filterUnits="userSpaceOnUse"
                colorInterpolationFilters="sRGB"
              >
                <feFlood floodOpacity="0" result="BackgroundImageFix" />
                <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
                <feColorMatrix
                  in="SourceAlpha"
                  type="matrix"
                  values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                  result="hardAlpha"
                />
                <feOffset />
                <feGaussianBlur stdDeviation="2.65" />
                <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
                <feColorMatrix type="matrix" values={theme.flapInsetColor} />
                <feBlend mode="normal" in2="shape" result="effect1_innerShadow" />
              </filter>
            </defs>
          </svg>
        </motion.div>
      </div>
    </div>
  );
}

const Card = ({ filterId, theme }: { filterId: string; theme: Theme }) => {
  return (
    <svg width="164" height="214" viewBox="0 0 164 214" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g filter={`url(#${filterId})`}>
        <rect width="163.078" height="213.262" rx="20" fill={theme.cardFill} />
      </g>
      <rect x="0.5" y="0.5" width="162.078" height="212.262" rx="19.5" stroke={theme.cardStroke} />
      <rect x="14.1193" y="31.2091" width="134.84" height="11.8892" rx="5.94459" fill={theme.cardLineFill} />
      <rect
        width="64.5183"
        height="5.88276"
        rx="2.94138"
        transform="matrix(1 -0.000409158 0.00201956 0.999998 14.8253 60.9939)"
        fill={theme.cardLineFill}
      />
      <rect
        width="64.5183"
        height="5.88276"
        rx="2.94138"
        transform="matrix(1 -0.000461045 0.00179228 0.999998 84.4303 60.9617)"
        fill={theme.cardLineFill}
      />
      <rect
        width="64.5183"
        height="5.88276"
        rx="2.94138"
        transform="matrix(1 -0.000409158 0.00201956 0.999998 14.8253 75.1122)"
        fill={theme.cardLineFill}
      />
      <rect
        width="64.5183"
        height="5.88276"
        rx="2.94138"
        transform="matrix(1 -0.000461045 0.00179228 0.999998 84.4303 75.0801)"
        fill={theme.cardLineFill}
      />
      <rect
        width="64.5183"
        height="5.88276"
        rx="2.94138"
        transform="matrix(1 -0.000409158 0.00201956 0.999998 14.8253 89.2306)"
        fill={theme.cardLineFill}
      />
      <rect
        width="64.5183"
        height="5.88276"
        rx="2.94138"
        transform="matrix(1 -0.000461045 0.00179228 0.999998 84.4303 89.1985)"
        fill={theme.cardLineFill}
      />
      <rect
        width="64.5183"
        height="5.88276"
        rx="2.94138"
        transform="matrix(1 -0.000409158 0.00201956 0.999998 14.8253 103.349)"
        fill={theme.cardLineFill}
      />
      <rect
        width="64.5183"
        height="5.88276"
        rx="2.94138"
        transform="matrix(1 -0.000461045 0.00179228 0.999998 84.4303 103.317)"
        fill={theme.cardLineFill}
      />
      <rect
        width="64.5183"
        height="5.88276"
        rx="2.94138"
        transform="matrix(1 -0.000409158 0.00201956 0.999998 14.8253 117.467)"
        fill={theme.cardLineFill}
      />
      <rect
        width="64.5183"
        height="5.88276"
        rx="2.94138"
        transform="matrix(1 -0.000461045 0.00179228 0.999998 84.4303 117.435)"
        fill={theme.cardLineFill}
      />
      <rect
        width="64.5183"
        height="5.88276"
        rx="2.94138"
        transform="matrix(1 -0.000409158 0.00201956 0.999998 14.8253 131.586)"
        fill={theme.cardLineFill}
      />
      <rect
        width="64.5183"
        height="5.88276"
        rx="2.94138"
        transform="matrix(1 -0.000461045 0.00179228 0.999998 84.4303 131.554)"
        fill={theme.cardLineFill}
      />
      <rect
        width="64.5183"
        height="5.88276"
        rx="2.94138"
        transform="matrix(1 -0.000409158 0.00201956 0.999998 14.8253 145.704)"
        fill={theme.cardLineFill}
      />
      <rect
        width="64.5183"
        height="5.88276"
        rx="2.94138"
        transform="matrix(1 -0.000461045 0.00179228 0.999998 84.4303 145.672)"
        fill={theme.cardLineFill}
      />
      <rect
        width="64.5183"
        height="5.88276"
        rx="2.94138"
        transform="matrix(1 -0.000409158 0.00201956 0.999998 14.8253 159.823)"
        fill={theme.cardLineFill}
      />
      <rect
        width="64.5183"
        height="5.88276"
        rx="2.94138"
        transform="matrix(1 -0.000461045 0.00179228 0.999998 84.4303 159.79)"
        fill={theme.cardLineFill}
      />
      <rect
        width="64.5183"
        height="5.88276"
        rx="2.94138"
        transform="matrix(1 -0.000409158 0.00201956 0.999998 14.8253 173.941)"
        fill={theme.cardLineFill}
      />
      <rect
        width="64.5183"
        height="5.88276"
        rx="2.94138"
        transform="matrix(1 -0.000461045 0.00179228 0.999998 84.4303 173.909)"
        fill={theme.cardLineFill}
      />
      <defs>
        <filter
          id={filterId}
          x="0"
          y="0"
          width="166.078"
          height="218.262"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          />
          <feMorphology radius="2" operator="erode" in="SourceAlpha" result="innerShadow" />
          <feOffset dx="3" dy="5" />
          <feGaussianBlur stdDeviation="3.05" />
          <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
          <feColorMatrix type="matrix" values={theme.cardInsetColor} />
          <feBlend mode="normal" in2="shape" result="innerShadow" />
        </filter>
      </defs>
    </svg>
  );
};
