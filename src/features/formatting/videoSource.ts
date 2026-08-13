/**
 * What a pasted video URL actually is.
 *
 * Four renderers need to agree on this - the editor canvas, Present mode, the
 * HTML export and the .pptx exporter - and each needs a different form of the
 * same link: an embed URL for an iframe, a plain file URL for a <video>, and a
 * watch URL for PowerPoint's online-video shape.
 */

export type VideoKind = 'youtube' | 'vimeo' | 'file';

export interface VideoSource {
  kind: VideoKind;
  /** Provider id, for youtube/vimeo. */
  id?: string;
  /** What an iframe (or <video>, for a file) should load. */
  embedUrl: string;
  /** The human-facing link, used for the .pptx hyperlink fallback. */
  watchUrl: string;
}

const YT = [
  /(?:youtube\.com|youtube-nocookie\.com)\/watch\?(?:.*&)?v=([\w-]{6,})/i,
  /youtu\.be\/([\w-]{6,})/i,
  /(?:youtube\.com|youtube-nocookie\.com)\/(?:embed|shorts|live)\/([\w-]{6,})/i,
];

const VIMEO = [/vimeo\.com\/(?:video\/)?(\d{6,})/i, /player\.vimeo\.com\/video\/(\d{6,})/i];

/** Parses a URL a user pasted; returns null for anything that isn't usable. */
export function parseVideoSource(raw: string | undefined): VideoSource | null {
  const url = (raw ?? '').trim();
  if (!url) return null;

  for (const re of YT) {
    const m = url.match(re);
    if (m) {
      return {
        kind: 'youtube',
        id: m[1],
        embedUrl: `https://www.youtube.com/embed/${m[1]}?rel=0`,
        watchUrl: `https://www.youtube.com/watch?v=${m[1]}`,
      };
    }
  }

  for (const re of VIMEO) {
    const m = url.match(re);
    if (m) {
      return {
        kind: 'vimeo',
        id: m[1],
        embedUrl: `https://player.vimeo.com/video/${m[1]}`,
        watchUrl: `https://vimeo.com/${m[1]}`,
      };
    }
  }

  if (!/^https?:\/\//i.test(url) && !url.startsWith('blob:') && !url.startsWith('data:')) return null;
  return { kind: 'file', embedUrl: url, watchUrl: url };
}

/** Options an <iframe> embed takes; providers spell them differently. */
export function embedWithOptions(
  src: VideoSource,
  o: { autoplay?: boolean; loop?: boolean; muted?: boolean }
): string {
  if (src.kind === 'file') return src.embedUrl;
  const p = new URLSearchParams();
  if (o.autoplay) p.set('autoplay', '1');
  if (o.loop) p.set('loop', '1');
  // Browsers block sound-on autoplay, so autoplay implies muted or nothing plays at all.
  if (o.muted || o.autoplay) p.set('muted', '1');
  if (src.kind === 'youtube') {
    if (o.loop && src.id) p.set('playlist', src.id);
    if (o.muted || o.autoplay) p.set('mute', '1');
  }
  const query = p.toString();
  if (!query) return src.embedUrl;
  return `${src.embedUrl}${src.embedUrl.includes('?') ? '&' : '?'}${query}`;
}

/** Provider thumbnail, used as a poster where we can't decode a frame ourselves. */
export function posterFor(src: VideoSource): string | undefined {
  if (src.kind === 'youtube' && src.id) return `https://img.youtube.com/vi/${src.id}/maxresdefault.jpg`;
  return undefined;
}

export function sourceLabel(src: VideoSource | null): string {
  if (!src) return 'No source';
  if (src.kind === 'youtube') return 'YouTube';
  if (src.kind === 'vimeo') return 'Vimeo';
  return 'Video file';
}
