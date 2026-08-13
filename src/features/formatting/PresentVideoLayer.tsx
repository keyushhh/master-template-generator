/**
 * Live video players during a presentation.
 *
 * A separate layer rather than part of ShapeOverlay because Present mode covers
 * the slide with a full-bleed click-catcher (click to advance, drag to draw).
 * Anything inside the slide's own stacking context therefore sits under it and
 * can never be clicked - so the players are mounted above it, and only the video
 * boxes themselves take the pointer.
 */

import type { SlideContent } from '../deck/types';
import { overlayOf } from './overlayModel';
import { VideoShapeVisual } from './VideoShapeVisual';

const SLIDE_W = 1920;
const SLIDE_H = 1080;

export function PresentVideoLayer({ content, scale }: { content: SlideContent; scale: number }) {
  const videos = overlayOf(content).filter(
    (s) => s.kind === 'video' && (s.videoUrl || s.videoAssetId)
  );
  if (!videos.length) return null;

  return (
    <div
      style={{
        position: 'absolute', inset: 0,
        pointerEvents: 'none',
        width: SLIDE_W * scale, height: SLIDE_H * scale,
        overflow: 'hidden',
      }}
    >
      {videos.map((shape) => (
        <div
          key={shape.id}
          style={{
            position: 'absolute',
            left: shape.x * scale,
            top: shape.y * scale,
            width: shape.w * scale,
            height: shape.h * scale,
            pointerEvents: 'auto',
          }}
        >
          <VideoShapeVisual shape={shape} playable />
        </div>
      ))}
    </div>
  );
}
