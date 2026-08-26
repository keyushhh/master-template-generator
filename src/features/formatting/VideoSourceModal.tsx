/**
 * Where a video shape gets its source: a pasted link, or a file from disk.
 *
 * The two are deliberately side by side rather than behind a toggle - a pasted
 * YouTube link travels with the deck anywhere, while an uploaded file lives in
 * this browser's IndexedDB, and that difference is worth stating at the moment
 * of choosing rather than discovering later.
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { OverlayShape } from '../deck/types';
import { MAX_VIDEO_BYTES, VideoTooLargeError, putVideo } from '../deck/mediaStore';
import { parseVideoSource, posterFor, sourceLabel } from './videoSource';
import { useFocusTrap } from '../a11y/useFocusTrap';

type VideoPatch = Pick<
  OverlayShape,
  'videoUrl' | 'videoAssetId' | 'videoName' | 'posterUrl' | 'autoplay' | 'loop' | 'muted'
>;

export function VideoSourceModal({
  open, shape, onApply, onClose,
}: {
  open: boolean;
  shape?: OverlayShape;
  onApply: (patch: VideoPatch) => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useFocusTrap(panelRef, open);

  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setUrl(shape?.videoUrl ?? '');
    setError(null);
    setBusy(false);
  }, [open, shape?.videoUrl]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const parsed = parseVideoSource(url);

  const applyUrl = () => {
    const src = parseVideoSource(url);
    if (!src) {
      setError('Paste a YouTube or Vimeo link, or a direct link to a video file.');
      return;
    }
    onApply({
      videoUrl: url.trim(),
      videoAssetId: undefined,
      videoName: undefined,
      posterUrl: posterFor(src),
    });
    onClose();
  };

  const applyFile = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const asset = await putVideo(file);
      const poster = await firstFrame(file);
      onApply({
        videoAssetId: asset.id,
        videoName: asset.name,
        videoUrl: undefined,
        posterUrl: poster,
      });
      onClose();
    } catch (e) {
      setError(
        e instanceof VideoTooLargeError
          ? e.message
          : 'That file could not be stored. It may not be a video this browser can play.'
      );
    } finally {
      setBusy(false);
    }
  };

  const hasSource = !!(shape?.videoUrl || shape?.videoAssetId);

  return createPortal(
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40 p-4" onMouseDown={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Video source"
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-[520px] bg-white border border-neutral-200 shadow-xl p-5"
      >
        <h3 className="text-[15px] font-bold text-neutral-900">Video source</h3>
        <p className="mt-1.5 text-[13px] text-neutral-600 leading-relaxed">
          A link plays anywhere the deck goes. An uploaded file is stored in this browser and travels
          only in the HTML and PowerPoint exports.
        </p>

        <label className="mt-4 block text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-600 font-mono">
          Paste a link
        </label>
        <div className="mt-1.5 flex gap-2">
          <input
            autoFocus
            value={url}
            onChange={(e) => { setUrl(e.target.value); setError(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter') applyUrl(); }}
            placeholder="https://www.youtube.com/watch?v=…"
            spellCheck={false}
            className="flex-1 min-w-0 h-9 px-2.5 text-[13px] text-neutral-900 border border-neutral-200 focus:border-emerald-500 outline-none"
          />
          <button
            onClick={applyUrl}
            disabled={!url.trim()}
            className="h-9 px-3.5 text-[13px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-neutral-200 disabled:text-neutral-600 transition-colors cursor-pointer"
          >
            Use link
          </button>
        </div>
        {url.trim() && (
          <p className="mt-1.5 text-[11.5px] font-mono text-neutral-600">
            {parsed ? `Recognised as ${sourceLabel(parsed)}` : 'Not a link we can play'}
          </p>
        )}

        <div className="my-4 flex items-center gap-3">
          <span className="h-px flex-1 bg-neutral-200" />
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-300 font-mono">or</span>
          <span className="h-px flex-1 bg-neutral-200" />
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void applyFile(file);
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="w-full h-11 text-[13px] font-bold text-neutral-700 border border-dashed border-neutral-300 hover:border-emerald-500 hover:text-emerald-700 transition-colors cursor-pointer disabled:opacity-50"
        >
          {busy ? 'Storing…' : 'Upload a video file'}
        </button>
        <p className="mt-1.5 text-[11.5px] text-neutral-600">
          Up to {MAX_VIDEO_BYTES / (1024 * 1024)}MB. {shape?.videoName ? `Current: ${shape.videoName}` : ''}
        </p>

        {error && <p className="mt-3 text-[12.5px] text-red-600">{error}</p>}

        <div className="mt-5 flex justify-between gap-2">
          {hasSource ? (
            <button
              onClick={() => {
                onApply({ videoUrl: undefined, videoAssetId: undefined, videoName: undefined, posterUrl: undefined });
                onClose();
              }}
              className="h-8 px-3.5 text-[13px] font-bold text-red-600 border border-neutral-200 hover:bg-red-50 transition-colors cursor-pointer"
            >
              Clear source
            </button>
          ) : <span />}
          <button
            onClick={onClose}
            className="h-8 px-3.5 text-[13px] font-bold text-neutral-700 border border-neutral-200 hover:bg-neutral-50 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Grabs a frame for the poster, which is what the .pptx and view mode show. */
async function firstFrame(file: File): Promise<string | undefined> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement('video');
    video.muted = true;
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error('decode failed'));
    });
    // A frame in rather than 0s, which is black on most encodes.
    video.currentTime = Math.min(1, (video.duration || 2) / 4);
    await new Promise<void>((resolve) => { video.onseeked = () => resolve(); });
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 1280 / (video.videoWidth || 1280));
    canvas.width = Math.round((video.videoWidth || 1280) * scale);
    canvas.height = Math.round((video.videoHeight || 720) * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.8);
  } catch {
    return undefined;
  } finally {
    URL.revokeObjectURL(url);
  }
}
