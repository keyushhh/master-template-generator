/**
 * The colours in a client's logo, and which one should be the accent.
 *
 * Setting up a kit meant finding the client's hex first: open the logo in
 * another tool, pick the colour, come back, type six characters. The logo is
 * already a file the user has to hand, and a canvas can read it, so the setup
 * is a drop.
 *
 * Deliberately a suggestion rather than a decision. What comes back is the
 * logo's own colours in order of how much of the mark they cover, with one of
 * them proposed as the accent; the user picks. An accent is a design judgement
 * about which colour means "this is the point", and the biggest area in a logo
 * is often its background.
 */

export interface LogoColour {
  /** Bare 6-digit uppercase hex. */
  hex: string;
  /** Fraction of the sampled pixels this colour bucket covers, 0-1. */
  share: number;
}

/** Sampling grid. 96x96 is plenty to find a logo's colours and costs nothing. */
const SAMPLE = 96;
/** Bucket size per channel: 32 groups colours a human reads as the same one. */
const BUCKET = 32;

function toHex(r: number, g: number, b: number): string {
  return [r, g, b].map((v) => Math.min(255, Math.max(0, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase();
}

/** Saturation and lightness, 0-1, from 8-bit RGB. */
export function saturationLightness(r: number, g: number, b: number): { s: number; l: number } {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { s, l };
}

/**
 * Reads an image's colours in a canvas.
 *
 * Transparent and near-transparent pixels are skipped: a logo is usually a PNG
 * on nothing, and counting its transparent corners would make "the colour of
 * this logo" mean the colour of the page behind it.
 */
export async function logoPalette(src: string): Promise<LogoColour[]> {
  const image = await loadImage(src);
  const canvas = document.createElement('canvas');
  canvas.width = SAMPLE;
  canvas.height = SAMPLE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];
  ctx.drawImage(image, 0, 0, SAMPLE, SAMPLE);

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, SAMPLE, SAMPLE).data;
  } catch {
    // A cross-origin image taints the canvas. Uploaded logos are data URLs, so
    // this only happens for a logo referenced by URL in a record's frontmatter.
    return [];
  }

  const buckets = new Map<string, { r: number; g: number; b: number; n: number }>();
  let counted = 0;
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha < 128) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = `${Math.round(r / BUCKET)}-${Math.round(g / BUCKET)}-${Math.round(b / BUCKET)}`;
    const bucket = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0 };
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    bucket.n += 1;
    buckets.set(key, bucket);
    counted += 1;
  }
  if (!counted) return [];

  return [...buckets.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, 8)
    // The bucket's average, not its corner: a logo's blue should come back as
    // the blue it is, not as the nearest multiple of 32.
    .map((bucket) => ({ hex: toHex(bucket.r / bucket.n, bucket.g / bucket.n, bucket.b / bucket.n), share: bucket.n / counted }));
}

/**
 * Which of a logo's colours to offer as the accent.
 *
 * Emerald in the house theme means "this is the point", so its replacement has
 * to be able to carry the same weight: coloured enough to read as deliberate,
 * and mid-toned enough to work as a fill behind white text and as text on a
 * light ground. White, near-black and grey are a logo's most common colours and
 * none of them can do that job, so they are passed over rather than proposed
 * and then found wanting on fourteen layouts.
 */
export function proposeAccent(colours: LogoColour[]): string | undefined {
  const usable = colours.filter(({ hex }) => {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const { s, l } = saturationLightness(r, g, b);
    return s > 0.22 && l > 0.14 && l < 0.78;
  });
  return usable[0]?.hex ?? colours.find((c) => c.hex !== 'FFFFFF' && c.hex !== '000000')?.hex;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('That image could not be read.'));
    image.src = src;
  });
}
