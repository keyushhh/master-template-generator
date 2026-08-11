/**
 * Renders and manipulates the user-inserted shapes layered on a slide.
 *
 * Returns a flat fragment of absolutely-positioned elements rather than wrapping
 * them in a container div. That is deliberate: the slide's own layers use
 * explicit z-indexes (grid at 0, template content at 10), and a wrapper would
 * create a stacking context that trapped every shape either entirely below or
 * entirely above that content - making the "send behind slide content" control
 * impossible to honour.
 *
 * Interaction: click to select, drag to move, eight handles to resize,
 * double-click a text box to edit its text. Everything snaps to the brand grid
 * unless Alt is held.
 */

import { useEffect, useRef, useState } from 'react';
import type { OverlayShape } from '../deck/types';
import { applyToCss } from './resolve';
import { MIN_SIZE, clampToSlide, snapMove, snapResize, type Handle, type Rect } from './snap';

/** z-index bands. The slide's grid sits at 0 and its template content at 10,
 *  so these bracket it without colliding. */
const Z_BEHIND = 1;
const Z_FRONT = 15;

const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

interface ShapeOverlayProps {
  shapes: OverlayShape[];
  editing: boolean;
  /** Id of the currently selected shape, if the selection is on this slide. */
  selectedId?: string;
  onSelect: (id: string) => void;
  /** Geometry/content patch for one shape. */
  onPatch: (id: string, patch: Partial<OverlayShape>) => void;
}

/** Reads the live scale of the slide this overlay sits in.
 *
 *  The canvas scales slides with a CSS transform, so a pointer movement of N
 *  screen px is N/scale design px. Measuring the element each drag (rather than
 *  caching) keeps dragging correct after a window resize, which re-runs the
 *  scaler. */
/** Downscales a picked image to a JPEG data URL, mirroring the canvas's own
 *  image handling so an inserted image can't balloon localStorage. */
async function fileToDataUrl(file: File, maxDim = 1600): Promise<string> {
  const raw = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(new Error('read failed'));
    r.readAsDataURL(file);
  });
  try {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = raw; });
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return raw;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  } catch {
    return raw;
  }
}

function slideScale(el: HTMLElement | null): number {
  const slide = el?.closest<HTMLElement>('[data-slide]');
  if (!slide) return 1;
  const rect = slide.getBoundingClientRect();
  return rect.width ? rect.width / 1920 : 1;
}

export function ShapeOverlay({ shapes, editing, selectedId, onSelect, onPatch }: ShapeOverlayProps) {
  /** Which text box is in text-entry mode. Kept separate from selection so a
   *  selected text box can still be dragged - only an actively-edited one
   *  surrenders pointer drags to the caret. */
  const [textEditId, setTextEditId] = useState<string | null>(null);

  /** Live geometry during a drag, so the shape follows the pointer without
   *  writing to the deck (and pushing an undo entry) on every mouse move. */
  const [live, setLive] = useState<{ id: string; rect: Rect } | null>(null);

  /** One shared file input, retargeted per shape - simpler than one input per
   *  image shape on the slide. */
  const fileRef = useRef<HTMLInputElement>(null);
  const pickingFor = useRef<string | null>(null);
  const dragRef = useRef<{
    id: string;
    handle: Handle | null;
    startRect: Rect;
    startX: number;
    startY: number;
    scale: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    if (!editing) { setTextEditId(null); setLive(null); }
  }, [editing]);

  // Leaving a shape selected but dropping out of text-edit mode when the
  // selection moves elsewhere keeps the caret from lingering invisibly.
  useEffect(() => {
    if (textEditId && textEditId !== selectedId) setTextEditId(null);
  }, [selectedId, textEditId]);

  useEffect(() => {
    if (!live) return;

    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = (e.clientX - d.startX) / d.scale;
      const dy = (e.clientY - d.startY) / d.scale;
      // A few px of slop before a click counts as a drag, so selecting a shape
      // with a slightly unsteady hand doesn't nudge it.
      if (!d.moved && Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
      d.moved = true;
      const free = e.altKey;
      const rect = d.handle
        ? snapResize(d.startRect, d.handle, dx, dy, free)
        : clampToSlide(snapMove({ ...d.startRect, x: d.startRect.x + dx, y: d.startRect.y + dy }, free));
      setLive({ id: d.id, rect });
    };

    const onUp = () => {
      const d = dragRef.current;
      // Only commit when something actually moved - a plain click should select
      // without creating an undo step.
      if (d?.moved && live) onPatch(live.id, live.rect);
      dragRef.current = null;
      setLive(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [live, onPatch]);

  const beginDrag = (
    e: React.PointerEvent,
    shape: OverlayShape,
    handle: Handle | null
  ) => {
    if (!editing || textEditId === shape.id) return;
    e.stopPropagation();
    e.preventDefault();
    onSelect(shape.id);
    const rect: Rect = { x: shape.x, y: shape.y, w: shape.w, h: shape.h };
    dragRef.current = {
      id: shape.id,
      handle,
      startRect: rect,
      startX: e.clientX,
      startY: e.clientY,
      scale: slideScale(e.currentTarget as HTMLElement),
      moved: false,
    };
    setLive({ id: shape.id, rect });
  };

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          const id = pickingFor.current;
          e.target.value = '';
          pickingFor.current = null;
          if (!file || !id) return;
          try { onPatch(id, { imageUrl: await fileToDataUrl(file) }); } catch { /* ignore bad file */ }
        }}
      />
      {shapes.map((shape, i) => {
        const isSel = editing && selectedId === shape.id;
        const rect = live?.id === shape.id ? live.rect : shape;
        const inTextEdit = textEditId === shape.id;

        const frame: React.CSSProperties = {
          position: 'absolute',
          left: rect.x,
          top: rect.y,
          width: rect.w,
          height: rect.h,
          zIndex: (shape.behind ? Z_BEHIND : Z_FRONT) + i,
          boxSizing: 'border-box',
          // Shapes must not intercept clicks outside edit mode, or they would
          // block the template's own editable fields underneath.
          pointerEvents: editing ? 'auto' : 'none',
          cursor: editing ? (inTextEdit ? 'text' : 'move') : 'default',
          background: shape.fill ? `#${shape.fill}` : undefined,
          border: shape.line
            ? `${Math.max(1, shape.line.widthPx)}px solid #${shape.line.color}`
            : undefined,
          borderRadius: shape.kind === 'ellipse' ? '50%' : 0,
          // A selected shape gets an outline rather than a border so its own
          // border width (and therefore its layout) is untouched by selection.
          outline: isSel ? '2px solid var(--emerald-500)' : undefined,
          outlineOffset: 1,
        };

        return (
          <div
            key={shape.id}
            data-overlay-shape={shape.id}
            style={frame}
            onPointerDown={(e) => beginDrag(e, shape, null)}
            onDoubleClick={(e) => {
              if (!editing) return;
              e.stopPropagation();
              if (shape.kind === 'text') { setTextEditId(shape.id); return; }
              if (shape.kind === 'image') {
                pickingFor.current = shape.id;
                fileRef.current?.click();
              }
            }}
          >
            {shape.kind === 'image' && shape.imageUrl && (
              <img
                src={shape.imageUrl}
                alt=""
                draggable={false}
                style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
              />
            )}

            {shape.kind === 'image' && !shape.imageUrl && editing && (
              <div
                style={{
                  width: '100%', height: '100%', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  background: 'var(--neutral-100)',
                  border: '3px dashed var(--neutral-300)',
                  fontFamily: 'var(--font-mono)', fontSize: 18,
                  color: 'var(--neutral-400)', textTransform: 'uppercase',
                  letterSpacing: '0.12em', textAlign: 'center', padding: 20,
                }}
              >
                Double-click to add image
              </div>
            )}

            {shape.kind === 'text' && (
              <div
                style={{
                  width: '100%', height: '100%', display: 'flex',
                  flexDirection: 'column',
                  justifyContent:
                    shape.vAlign === 'middle' ? 'center'
                      : shape.vAlign === 'bottom' ? 'flex-end' : 'flex-start',
                  // Text is allowed to exceed its box rather than be clipped -
                  // silently hidden copy is worse than copy that overflows
                  // visibly, because the user can see and fix the second.
                  overflow: 'visible',
                }}
              >
                <span
                  contentEditable={inTextEdit}
                  suppressContentEditableWarning
                  spellCheck={false}
                  onPointerDown={(e) => { if (inTextEdit) e.stopPropagation(); }}
                  onBlur={(e) => {
                    setTextEditId(null);
                    const next = (e.currentTarget as HTMLElement).innerText.replace(/ /g, ' ');
                    if (next !== (shape.text ?? '')) onPatch(shape.id, { text: next });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      (e.currentTarget as HTMLElement).innerText = shape.text ?? '';
                      (e.currentTarget as HTMLElement).blur();
                    }
                  }}
                  onPaste={(e) => {
                    e.preventDefault();
                    document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
                  }}
                  style={{
                    display: 'block',
                    fontFamily: 'var(--font-display)',
                    fontSize: 32,
                    lineHeight: 1.3,
                    whiteSpace: 'pre-wrap',
                    outline: inTextEdit ? '1px dashed var(--emerald-400)' : 'none',
                    ...applyToCss(shape.style),
                  }}
                >
                  {shape.text ?? ''}
                </span>
              </div>
            )}

            {/* Resize handles - edit mode only, so the exported/view-mode DOM
                that html2canvas captures stays clean. */}
            {isSel && !inTextEdit && HANDLES.map((h) => {
              const pos: React.CSSProperties = { position: 'absolute' };
              if (h.includes('n')) pos.top = -5;
              if (h.includes('s')) pos.bottom = -5;
              if (h.includes('w')) pos.left = -5;
              if (h.includes('e')) pos.right = -5;
              if (h === 'n' || h === 's') { pos.left = '50%'; pos.marginLeft = -5; }
              if (h === 'e' || h === 'w') { pos.top = '50%'; pos.marginTop = -5; }
              return (
                <div
                  key={h}
                  onPointerDown={(e) => beginDrag(e, shape, h)}
                  style={{
                    ...pos,
                    width: 10, height: 10,
                    background: '#fff',
                    border: '2px solid var(--emerald-500)',
                    cursor: `${h}-resize`,
                    zIndex: 2,
                  }}
                />
              );
            })}
          </div>
        );
      })}
    </>
  );
}

export { MIN_SIZE };
