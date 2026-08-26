/**
 * The picture inside a video shape.
 *
 * Only `playable` (Present mode's own layer) mounts a real player. Everywhere
 * else - the editor, thumbnails, the PDF/PNG capture - it draws the poster: an
 * iframe would swallow the pointer events the overlay needs for dragging, and a
 * rail of twelve thumbnails would each start loading a video.
 */

import { useEffect, useState } from 'react';
import type { OverlayShape } from '../deck/types';
import { videoUrl } from '../deck/mediaStore';
import { embedWithOptions, parseVideoSource, sourceLabel } from './videoSource';
import { PlayCircleIcon } from '../ui/icons';

export function VideoShapeVisual({
  shape, editing, playable,
}: {
  shape: OverlayShape;
  editing?: boolean;
  /** Present mode's layer, the only place a live player is mounted. */
  playable?: boolean;
}) {
  const [assetUrl, setAssetUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!shape.videoAssetId) { setAssetUrl(null); return; }
    let alive = true;
    void videoUrl(shape.videoAssetId).then((u) => { if (alive) setAssetUrl(u); });
    return () => { alive = false; };
  }, [shape.videoAssetId]);

  const src = parseVideoSource(assetUrl ?? shape.videoUrl);
  const missingAsset = !!shape.videoAssetId && assetUrl === null;

  if (!src) {
    return (
      <Placeholder
        label={
          missingAsset
            ? `“${shape.videoName ?? 'Video'}” isn’t in this browser`
            : editing ? 'Double-click to add a video' : 'No video source'
        }
        hint={missingAsset ? 'It was uploaded on another machine or profile' : undefined}
      />
    );
  }

  if (!playable) {
    return (
      <Poster
        shape={shape}
        src={shape.posterUrl}
        label={shape.videoName ?? sourceLabel(src)}
      />
    );
  }

  // A local file plays through <video>: real controls, no network.
  if (src.kind === 'file') {
    return (
      <video
        src={src.embedUrl}
        poster={shape.posterUrl}
        controls
        autoPlay={shape.autoplay}
        loop={shape.loop}
        muted={shape.muted ?? true}
        playsInline
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', background: '#000' }}
      />
    );
  }

  return (
    <iframe
      src={embedWithOptions(src, { autoplay: shape.autoplay, loop: shape.loop, muted: shape.muted })}
      title={sourceLabel(src)}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture; fullscreen"
      allowFullScreen
      style={{ width: '100%', height: '100%', border: 0, display: 'block', background: '#000' }}
    />
  );
}

function Poster({ shape, src, label }: { shape: OverlayShape; src?: string; label: string }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#000', overflow: 'hidden' }}>
      {src && (
        <img src={src} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
      )}
      <span
        style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          color: '#fff', opacity: 0.92,
        }}
      >
        <PlayCircleIcon size={Math.max(36, Math.min(96, shape.h * 0.22))} />
      </span>
      <span
        style={{
          position: 'absolute', left: 12, bottom: 12,
          padding: '4px 8px', background: 'rgba(0,0,0,0.6)', color: '#fff',
          fontFamily: 'var(--font-mono)', fontSize: 13,
          textTransform: 'uppercase', letterSpacing: '0.1em',
          maxWidth: 'calc(100% - 24px)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
    </div>
  );
}

function Placeholder({ label, hint }: { label: string; hint?: string }) {
  return (
    <div
      style={{
        width: '100%', height: '100%', display: 'flex',
        flexDirection: 'column', gap: 8,
        alignItems: 'center', justifyContent: 'center',
        background: 'var(--neutral-100)',
        border: '3px dashed var(--neutral-300)',
        fontFamily: 'var(--font-mono)', fontSize: 18,
        color: 'var(--neutral-600)', textTransform: 'uppercase',
        letterSpacing: '0.12em', textAlign: 'center', padding: 20,
      }}
    >
      {label}
      {hint && <span style={{ fontSize: 13, textTransform: 'none', letterSpacing: 0 }}>{hint}</span>}
    </div>
  );
}
