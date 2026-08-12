import { useEffect, useRef, useState } from 'react';
import { FitStage } from '../generator/FitStage';
import { useFocusTrap } from '../a11y/useFocusTrap';
import { AddIcon, CheckIcon, CloseIcon, CreateIcon, TrashIcon } from '../ui/icons';
import { BUILT_IN_THEMES, accentRamp, css, isHex6, WOZKU_THEME, type DeckTheme } from './deckTheme';
import type { BrandKit } from './brandKitStore';
import type { DocumentNode } from '../business-record/parser/ast';
import type { Deck } from '../deck/types';

interface BrandKitModalProps {
  open: boolean;
  onClose: () => void;
  deck: Deck;
  ast: DocumentNode | null;
  /** Saved client kits. */
  kits: BrandKit[];
  /** Which theme the deck is currently on. */
  activeThemeId: string | undefined;
  onApply: (themeId: string | undefined) => void;
  onCreateKit: (name: string, accent: string) => void;
  onUpdateKit: (id: string, patch: { name?: string; accent?: string }) => void;
  onDeleteKit: (id: string) => void;
}

/** A few sensible starting colours, so creating a kit never begins on a blank
 *  field. Not a palette to choose from - the point is the client's own hex. */
const SUGGESTED = ['2563EB', 'DC2626', 'D97706', '7C3AED', '0F766E', '171717'];

/** Shows the four derived steps of an accent, which is the only honest preview of
 *  what one hex will actually do across fourteen templates. */
function Ramp({ accent }: { accent: string }) {
  const ramp = isHex6(accent) ? accentRamp(accent) : WOZKU_THEME.accent;
  const steps: { key: keyof typeof ramp; label: string }[] = [
    { key: 'tint', label: 'Tint' },
    { key: 'base', label: 'Base' },
    { key: 'deep', label: 'Deep' },
    { key: 'bright', label: 'Bright' },
  ];
  return (
    <div className="flex items-center gap-1.5">
      {steps.map((s) => (
        <div key={s.key} className="flex flex-col items-center gap-1">
          <span
            className="block w-7 h-7 border border-neutral-200"
            style={{ background: css(ramp[s.key]) }}
          />
          <span className="font-mono text-[8.5px] uppercase tracking-[0.08em] text-neutral-400">
            {s.label}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Brand kits: the client's colour, applied to the whole deck.
 *
 * This is the answer to "what if a deck is for a different client?" - and the
 * answer is deliberately *not* a second set of slide layouts. The fourteen
 * templates are the agency's thinking about how a deck should be built, and that
 * shouldn't fork per client; what changes per client is their colour and their
 * mark. So a kit re-skins all fourteen rather than adding a fifteenth.
 *
 * A kit is one hex. Everything else the templates need is derived from it, since
 * nobody's brand guidelines contain a "tint step", and four hand-picked colours
 * would drift out of relation with each other.
 *
 * Typography stays the agency's, which is both a design position and a technical
 * one: the exporter can only embed typefaces it ships files for, so a
 * free-choice font would silently re-render on the client's machine.
 */
export function BrandKitModal({
  open,
  onClose,
  deck,
  ast,
  kits,
  activeThemeId,
  onApply,
  onCreateKit,
  onUpdateKit,
  onDeleteKit,
}: BrandKitModalProps) {
  /** The row being edited, or 'new' while composing one. */
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftAccent, setDraftAccent] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open);

  useEffect(() => {
    if (!open) {
      setEditing(null);
      setPendingDeleteId(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Back out of the editor first, so Escape can't discard a half-typed kit
      // and the whole screen in one press.
      if (editing) setEditing(null);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, editing]);

  if (!open) return null;

  const cover = deck.slides.find((s) => !s.hidden) ?? deck.slides[0];

  const startNew = () => {
    setEditing('new');
    setDraftName('');
    setDraftAccent(SUGGESTED[0]);
  };
  const startEdit = (kit: BrandKit) => {
    setEditing(kit.id);
    setDraftName(kit.name);
    setDraftAccent(kit.accent);
  };

  const canSave = draftName.trim().length > 0 && isHex6(draftAccent);

  const commit = () => {
    if (!canSave) return;
    if (editing === 'new') onCreateKit(draftName, draftAccent);
    else if (editing) onUpdateKit(editing, { name: draftName, accent: draftAccent });
    setEditing(null);
  };

  /** Theme shown in the live preview: the one being edited, else the active one. */
  const previewTheme: DeckTheme = editing
    ? { ...WOZKU_THEME, id: 'preview', name: 'Preview', accent: accentRamp(isHex6(draftAccent) ? draftAccent : WOZKU_THEME.accent.base) }
    : [...BUILT_IN_THEMES, ...kits.map((k) => ({ ...WOZKU_THEME, id: k.id, name: k.name, accent: accentRamp(k.accent) }))]
        .find((t) => t.id === activeThemeId) ?? WOZKU_THEME;

  const rowBase =
    'group w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors cursor-pointer border';

  return (
    <div
      className="wg-overlay fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      onClick={() => onClose()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Brand kit"
        className="wg-modal flex flex-col w-full max-w-[760px] max-h-[90vh] overflow-hidden my-auto bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative flex flex-col gap-1 px-5 py-4 border-b border-neutral-150 shrink-0">
          <div className="font-mono text-[9.5px] font-bold tracking-[0.16em] uppercase text-neutral-400">
            Brand kit
          </div>
          <h2 className="text-[17px] font-bold text-neutral-900">Who is this deck for?</h2>
          <span className="text-[12px] text-neutral-500">
            One colour, applied across all fourteen layouts. The client&rsquo;s logo is set on the slide itself.
          </span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3.5 right-3.5 w-7 h-7 flex items-center justify-center text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer"
          >
            <CloseIcon size={15} />
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col sm:flex-row">
          {/* ── Live preview. A real slide through the real renderer, because a
                 row of swatches cannot tell you whether a colour works on the
                 cover. ─────────────────────────────────────────────────────── */}
          <div className="sm:w-[300px] shrink-0 p-5 bg-neutral-50 border-b sm:border-b-0 sm:border-r border-neutral-150 flex flex-col gap-3">
            {cover && (
              <div style={{ boxShadow: '0 0 0 1px var(--neutral-200), 0 6px 20px -8px rgba(15,23,20,0.25)' }}>
                <FitStage slide={cover} ast={ast} num="01" logoUrl={deck.logoUrl} theme={previewTheme} />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <span className="font-mono text-[9.5px] font-bold tracking-[0.16em] uppercase text-neutral-400">
                Derived steps
              </span>
              <Ramp accent={editing ? draftAccent : previewTheme.accent.base} />
              <span className="text-[11px] text-neutral-400 leading-snug">
                Built from your one colour so the four never drift out of relation.
              </span>
            </div>
          </div>

          {/* ── Kits ─────────────────────────────────────────────────────────── */}
          <div className="flex-1 min-w-0 overflow-y-auto p-4 flex flex-col gap-4">
            {editing ? (
              <div className="flex flex-col gap-3">
                <span className="font-mono text-[9.5px] font-bold tracking-[0.16em] uppercase text-neutral-400">
                  {editing === 'new' ? 'New client kit' : 'Edit kit'}
                </span>

                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-neutral-700">Client name</span>
                  <input
                    autoFocus
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && commit()}
                    placeholder="Northwind Group"
                    className="h-[38px] px-3 text-[13px] border border-neutral-200 focus:border-emerald-500 outline-none text-neutral-900"
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-neutral-700">Brand colour</span>
                  <div className="flex items-center gap-2">
                    {/* The OS picker and a hex field, because a brand colour
                        arrives as a hex from a guidelines PDF at least as often
                        as it gets eyeballed. */}
                    <input
                      type="color"
                      value={css(isHex6(draftAccent) ? draftAccent.replace('#', '') : WOZKU_THEME.accent.base)}
                      onChange={(e) => setDraftAccent(e.target.value.replace('#', '').toUpperCase())}
                      aria-label="Pick brand colour"
                      className="w-[38px] h-[38px] p-0 border border-neutral-200 bg-white cursor-pointer"
                    />
                    <span className="flex items-center h-[38px] px-3 border border-neutral-200 focus-within:border-emerald-500">
                      <span className="font-mono text-[13px] text-neutral-400 pr-0.5">#</span>
                      <input
                        value={draftAccent.replace('#', '')}
                        onChange={(e) => setDraftAccent(e.target.value.replace('#', '').toUpperCase().slice(0, 6))}
                        onKeyDown={(e) => e.key === 'Enter' && commit()}
                        spellCheck={false}
                        className="w-[80px] font-mono text-[13px] outline-none text-neutral-900 uppercase"
                      />
                    </span>
                    {!isHex6(draftAccent) && draftAccent.length > 0 && (
                      <span className="text-[11.5px] text-amber-700">Needs 6 hex digits</span>
                    )}
                  </div>
                </label>

                <div className="flex items-center gap-1.5">
                  {SUGGESTED.map((hex) => (
                    <button
                      key={hex}
                      onClick={() => setDraftAccent(hex)}
                      aria-label={`Use #${hex}`}
                      title={`#${hex}`}
                      className="w-6 h-6 border border-neutral-200 hover:scale-110 transition-transform cursor-pointer"
                      style={{ background: css(hex) }}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={commit}
                    disabled={!canSave}
                    className="h-[36px] px-4 text-[12.5px] font-bold text-white bg-neutral-900 hover:bg-neutral-800 transition-colors cursor-pointer disabled:bg-neutral-300 disabled:cursor-not-allowed"
                  >
                    {editing === 'new' ? 'Create kit' : 'Save kit'}
                  </button>
                  <button
                    onClick={() => setEditing(null)}
                    className="h-[36px] px-4 text-[12.5px] font-bold text-neutral-700 border border-neutral-200 hover:bg-neutral-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  <span className="font-mono text-[9.5px] font-bold tracking-[0.16em] uppercase text-neutral-400">
                    House
                  </span>
                  {BUILT_IN_THEMES.map((t) => {
                    const active = (activeThemeId ?? WOZKU_THEME.id) === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => onApply(t.id === WOZKU_THEME.id ? undefined : t.id)}
                        className={`${rowBase} ${
                          active ? 'border-emerald-500 bg-emerald-50/60' : 'border-neutral-200 hover:border-neutral-400'
                        }`}
                      >
                        <span
                          className="shrink-0 w-6 h-6 border border-black/10"
                          style={{ background: css(t.accent.base) }}
                        />
                        <span className={`flex-1 text-[13px] ${active ? 'font-bold text-emerald-800' : 'font-semibold text-neutral-800'}`}>
                          {t.name}
                        </span>
                        {active && (
                          <span className="shrink-0 text-emerald-600 flex items-center">
                            <CheckIcon size={15} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="font-mono text-[9.5px] font-bold tracking-[0.16em] uppercase text-neutral-400">
                    Clients
                  </span>
                  {kits.length === 0 ? (
                    <p className="text-[12px] text-neutral-500 leading-relaxed py-1">
                      No client kits yet. Make one per client and every deck for them starts on their colour.
                    </p>
                  ) : (
                    kits.map((kit) => {
                      const active = activeThemeId === kit.id;
                      return (
                        <div
                          key={kit.id}
                          className={`${rowBase} ${
                            active ? 'border-emerald-500 bg-emerald-50/60' : 'border-neutral-200 hover:border-neutral-400'
                          }`}
                        >
                          <button
                            onClick={() => onApply(kit.id)}
                            className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer"
                          >
                            <span
                              className="shrink-0 w-6 h-6 border border-black/10"
                              style={{ background: css(kit.accent) }}
                            />
                            <span className="flex flex-col min-w-0">
                              <span className={`truncate text-[13px] ${active ? 'font-bold text-emerald-800' : 'font-semibold text-neutral-800'}`}>
                                {kit.name}
                              </span>
                              <span className="font-mono text-[10.5px] text-neutral-400">#{kit.accent}</span>
                            </span>
                          </button>
                          {active && (
                            <span className="shrink-0 text-emerald-600 flex items-center">
                              <CheckIcon size={15} />
                            </span>
                          )}
                          <button
                            onClick={() => startEdit(kit)}
                            aria-label={`Edit ${kit.name}`}
                            title="Edit"
                            className="shrink-0 w-7 h-7 flex items-center justify-center text-neutral-400 hover:text-neutral-800 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          >
                            <CreateIcon size={14} />
                          </button>
                          <button
                            onClick={() => setPendingDeleteId(kit.id)}
                            aria-label={`Delete ${kit.name}`}
                            title="Delete"
                            className="shrink-0 w-7 h-7 flex items-center justify-center text-neutral-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          >
                            <TrashIcon size={14} />
                          </button>
                        </div>
                      );
                    })
                  )}

                  <button
                    onClick={startNew}
                    className="flex items-center gap-2 px-3 py-2.5 border border-dashed border-neutral-300 text-[12.5px] font-bold text-neutral-700 hover:border-neutral-500 hover:bg-neutral-50 transition-colors cursor-pointer"
                  >
                    <AddIcon size={14} />
                    New client kit
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Delete confirmation. A kit can be referenced by decks that are not
            open, so this says what happens to them rather than just warning. */}
        {pendingDeleteId && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40" onMouseDown={() => setPendingDeleteId(null)}>
            <div className="w-[380px] bg-white shadow-xl p-5" onMouseDown={(e) => e.stopPropagation()}>
              <h3 className="text-[15px] font-bold text-neutral-900">
                Delete &ldquo;{kits.find((k) => k.id === pendingDeleteId)?.name}&rdquo;?
              </h3>
              <p className="mt-1.5 text-[13px] text-neutral-500 leading-relaxed">
                Any deck using this kit falls back to the Wozku look. The decks themselves are untouched.
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => setPendingDeleteId(null)}
                  className="h-8 px-3 text-[13px] font-bold text-neutral-700 border border-neutral-200 hover:bg-neutral-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onDeleteKit(pendingDeleteId);
                    setPendingDeleteId(null);
                  }}
                  className="h-8 px-3 text-[13px] font-bold text-white bg-red-600 hover:bg-red-700 cursor-pointer"
                >
                  Delete kit
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
