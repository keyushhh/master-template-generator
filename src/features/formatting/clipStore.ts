/**
 * Clipboard store for copying, pasting, and duplicating overlay shapes and slides.
 *
 * Stores transient clipboard state in memory so shapes and slides can be copied
 * across slides and decks within the active editing session.
 */

import type { OverlayShape, SlideInstance } from '../deck/types';
import { SLIDE_H, SLIDE_W } from './snap';

let copiedShape: OverlayShape | null = null;
let copiedSlide: SlideInstance | null = null;

let seq = 0;
function mintId(prefix: string): string {
  seq += 1;
  return `${prefix}_cp_${seq}_${Math.random().toString(36).slice(2, 7)}`;
}

export function setCopiedShape(shape: OverlayShape | null): void {
  copiedShape = shape ? JSON.parse(JSON.stringify(shape)) : null;
}

export function getCopiedShape(): OverlayShape | null {
  return copiedShape ? JSON.parse(JSON.stringify(copiedShape)) : null;
}

export function setCopiedSlide(slide: SlideInstance | null): void {
  copiedSlide = slide ? JSON.parse(JSON.stringify(slide)) : null;
}

export function getCopiedSlide(): SlideInstance | null {
  return copiedSlide ? JSON.parse(JSON.stringify(copiedSlide)) : null;
}

/**
 * Creates a duplicate of an overlay shape, offset by 20px x and y so it doesn't
 * sit directly over the original.
 */
export function duplicateShape(shape: OverlayShape): OverlayShape {
  const dup: OverlayShape = JSON.parse(JSON.stringify(shape));
  dup.id = mintId(shape.kind);
  const offset = 20;
  dup.x = Math.min(dup.x + offset, SLIDE_W - dup.w - 10);
  dup.y = Math.min(dup.y + offset, SLIDE_H - dup.h - 10);
  return dup;
}

/**
 * Creates a deep copy of a slide with a fresh ID and fresh overlay shape IDs.
 */
export function duplicateSlide(slide: SlideInstance): SlideInstance {
  const dup: SlideInstance = JSON.parse(JSON.stringify(slide));
  dup.instanceId = mintId('slide');
  if (dup.content.overlay) {
    dup.content.overlay = dup.content.overlay.map((s) => ({
      ...s,
      id: mintId(s.kind),
    }));
  }
  return dup;
}
