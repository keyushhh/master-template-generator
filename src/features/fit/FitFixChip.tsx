import { useCallback, useEffect, useState } from 'react';
import type { SlideContent, SlideInstance } from '../deck/types';
import { patchStyles } from '../formatting/resolve';
import { useToast } from '../toast/Toast';
import { WarningIcon } from '../ui/icons';
import { planAutoFit } from './autoFit';
import { SEVERE_BY } from './fitScan';
import { useSlideFit } from './fitStore';

/**
 * Says when the slide in front of you is cutting its own text off, and offers to
 * fix it.
 *
 * The rail badge tells you *which* slides have the problem; this is the one that
 * can do something about it, because the fix needs the slot identity that only
 * an editable slide carries. It sits in the bottom control strip beside the
 * slide counter and title, which is already the layer that talks about the
 * current slide, rather than floating over the canvas where it would cover the
 * thing it is describing.
 */
export function FitFixChip({
  slide,
  editing,
  onRequestEdit,
  onEditSlide,
}: {
  slide: SlideInstance;
  editing: boolean;
  onRequestEdit?: () => void;
  onEditSlide: (instanceId: string, updater: (c: SlideContent) => SlideContent) => void;
}) {
  const issues = useSlideFit(slide.instanceId);
  const { showToast } = useToast();
  /** Set when the fix was asked for from view mode: edit mode has to arrive, and
   *  the slots have to be in the DOM, before there is anything to measure. */
  const [pending, setPending] = useState(false);

  const apply = useCallback(() => {
    const root = document.getElementById(slide.instanceId);
    if (!root) return;

    const { plan, stubborn } = planAutoFit(root);

    if (plan.length) {
      // One patch for every slot, so the whole fix is a single undo. Reducing
      // four slots and then pressing Cmd+Z four times to get back is not an
      // undo, it is a chore.
      onEditSlide(slide.instanceId, (c) => {
        let styles = c.styles;
        for (const p of plan) styles = patchStyles(styles, p.slot, { sizePx: p.sizePx });
        return { ...c, styles };
      });
    }

    // Report both halves. A message that says "fixed 2" while quietly leaving a
    // third piece of text cut off is how you learn to distrust the warning.
    const fixed = plan.length
      ? `Brought ${plan.length} ${plan.length === 1 ? 'slot' : 'slots'} down to fit`
      : '';
    const left = stubborn.length
      ? `${stubborn.length} ${stubborn.length === 1 ? 'piece' : 'pieces'} of text needs shortening, not resizing`
      : '';

    if (fixed && left) showToast(`${fixed}. ${left}.`, 'info');
    else if (fixed) showToast(`${fixed}.`, 'success');
    else if (left) showToast(`Resizing cannot fix this. ${left}.`, 'error');
    else showToast('Nothing here needs resizing.', 'info');
  }, [slide.instanceId, onEditSlide, showToast]);

  // Edit mode has arrived; the slots exist now. One frame so the attributes are
  // actually in the DOM to be found.
  useEffect(() => {
    if (!pending || !editing) return;
    const raf = requestAnimationFrame(() => {
      setPending(false);
      apply();
    });
    return () => cancelAnimationFrame(raf);
  }, [pending, editing, apply]);

  if (issues.length === 0) return null;

  const severe = issues[0].by >= SEVERE_BY;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        pointerEvents: 'auto',
        height: 32,
        padding: '0 4px 0 9px',
        marginLeft: 10,
        background: severe ? '#fef2f2' : '#fffbeb',
        border: `1px solid ${severe ? '#fecaca' : '#fde68a'}`,
        boxShadow: '0 1px 2px rgba(15,23,20,0.05)',
      }}
      title={issues
        .slice(0, 4)
        .map((i) => `“${i.text}”`)
        .join('\n')}
    >
      <span style={{ display: 'flex', color: severe ? '#b91c1c' : '#b45309' }}>
        <WarningIcon size={13} />
      </span>
      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: severe ? '#7f1d1d' : '#78350f',
          whiteSpace: 'nowrap',
          userSelect: 'none',
        }}
      >
        {issues.length === 1 ? 'Text is cut off' : `${issues.length} pieces of text cut off`}
      </span>
      <button
        onClick={() => {
          if (editing) apply();
          else {
            // The fix writes a per-slot size override, and slots only exist on
            // an editable slide. Taking the user into edit mode is the honest
            // move: the change is an edit, and they should land where they can
            // see and undo it.
            onRequestEdit?.();
            setPending(true);
          }
        }}
        disabled={pending}
        style={{
          height: 24,
          padding: '0 9px',
          fontSize: 11.5,
          fontWeight: 700,
          color: '#fff',
          background: severe ? '#b91c1c' : '#b45309',
          border: 'none',
          cursor: pending ? 'default' : 'pointer',
          opacity: pending ? 0.6 : 1,
          borderRadius: 'var(--radius-sharp)',
        }}
        title="Reduce the type on this slide until nothing is cut off"
      >
        {pending ? 'Fitting…' : 'Fit it'}
      </button>
    </div>
  );
}
