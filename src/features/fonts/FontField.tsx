import { useState } from 'react';
import { fontStack } from '../formatting/rails';
import { ChevronDownIcon } from '../ui/icons';
import { FontPicker } from './FontPicker';
import { ensureFont } from './loadFont';

/**
 * One typeface role, as a labelled field with the picker folded underneath.
 *
 * Expands in place rather than opening a floating panel. The brand kit screen is a
 * modal with its own scrolling column, and a dropdown inside a scroll container is
 * the thing that gets clipped or left behind by a scroll - the same problem the
 * thumbnail menu and the changelog both had. Nothing can clip a field that grows.
 *
 * Shares `FontPicker` with the editing toolbar, so the search, the category chips
 * and the house-faces-first ordering cannot drift between the two places a
 * typeface gets chosen.
 */
export function FontField({
  label,
  hint,
  /** The family in effect: the kit's choice, or the house face it falls back to. */
  value,
  /** The house face for this role, shown when the kit has not overridden it. */
  fallback,
  onChange,
}: {
  label: string;
  hint: string;
  value?: string;
  fallback: string;
  /** `undefined` means "use the house face for this role". */
  onChange: (family: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const shown = value ?? fallback;

  return (
    <div className="flex flex-col">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`flex items-center gap-3 px-3 h-[46px] border text-left transition-colors cursor-pointer ${
          open ? 'border-neutral-500 bg-white' : 'border-neutral-200 bg-white hover:border-neutral-400'
        }`}
      >
        <span className="flex flex-col min-w-0 w-[74px] shrink-0">
          <span className="text-[11px] font-bold text-neutral-800">{label}</span>
          <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-neutral-600">
            {hint}
          </span>
        </span>
        {/* The name set in the face it names, so the field is a specimen and not
            just a label. */}
        <span
          className="flex-1 min-w-0 truncate text-[14px] text-neutral-900"
          style={{ fontFamily: fontStack(shown) }}
        >
          {shown}
        </span>
        {!value && (
          <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.1em] text-neutral-600">
            House
          </span>
        )}
        <span
          aria-hidden
          className="shrink-0 flex text-neutral-600"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}
        >
          <ChevronDownIcon size={13} />
        </span>
      </button>

      {open && (
        <div className="border border-t-0 border-neutral-200 bg-white p-2">
          <FontPicker
            current={shown}
            hasOverride={!!value}
            onPick={(family) => {
              // Requested immediately so the live cover preview beside this field
              // repaints in the real face rather than in a fallback.
              void ensureFont(family);
              onChange(family);
            }}
            onReset={() => onChange(undefined)}
            close={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
