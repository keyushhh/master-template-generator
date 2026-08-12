import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../a11y/useFocusTrap';
import { FitStage } from '../generator/FitStage';
import {
  brandKitThemes,
  createBrandKit,
  listBrandKits,
  type BrandKit,
} from '../theme/brandKitStore';
import {
  accentRamp,
  BUILT_IN_THEMES,
  css,
  themeById,
  WOZKU_THEME,
  type DeckTheme,
} from '../theme/deckTheme';
import { AddIcon, CheckIcon, CloseIcon, TrashIcon } from '../ui/icons';
import { ensureFonts } from '../fonts/loadFont';
import { DECK_STARTERS, type DeckStarter } from './deckStarters';
import { deleteDeckTemplate, instantiateDeckTemplate, listDeckTemplates, type SavedDeckTemplate } from './deckTemplateStore';
import type { Deck } from './types';
import { ConfirmModal, cannotBeUndone } from '../ui/ConfirmModal';

/** A saved template, shaped like a built-in starter so both can share one list. */
function starterFromTemplate(t: SavedDeckTemplate): DeckStarter & { custom: true; savedId: string } {
  return {
    id: `custom:${t.id}`,
    savedId: t.id,
    custom: true,
    name: t.name,
    description: t.description || `${t.slideCount} slide${t.slideCount === 1 ? '' : 's'}, saved from a deck.`,
    build: () => instantiateDeckTemplate(t),
  };
}

/** Colours to offer when composing a kit here. The same set the fuller brand kit
 *  manager offers, so a kit made in either place starts from the same palette. */
const SUGGESTED = ['0E9F6E', '2563EB', 'DC2626', 'D97706', '7C3AED', '0891B2'];

const isHex6 = (v: string) => /^[0-9a-fA-F]{6}$/.test(v.replace('#', ''));

/**
 * Starting a deck: what it is built from, and who it is for.
 *
 * This screen exists because the brand choice was in the wrong place. It used to
 * be a button in the studio's slide rail, which put "which client is this for"
 * next to "add a slide" - a decision about the whole deck sitting among the
 * decisions about one slide, and one you only found after you had already built
 * something in the house colours.
 *
 * It belongs at the start, next to the other question of the same size: which
 * template. Both are answered once, before there is any work to redo, and
 * putting them together is what makes room for the two lists to grow
 * independently. A set of client templates goes in the left column; a client's
 * colours go in the right; neither multiplies the other.
 *
 * Changing a deck's brand afterwards is still possible, through the command
 * palette in the studio. It is simply no longer taking up room in the rail for a
 * thing you do once.
 */
export function NewDeckModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  /** The deck already carries its `themeId`; the caller only has to store it. */
  onCreate: (name: string, deck: Deck) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open);

  const [name, setName] = useState('');
  const [starterId, setStarterId] = useState(DECK_STARTERS[0].id);
  /** `undefined` is the house look, the same thing an absent `themeId` means. */
  const [themeId, setThemeId] = useState<string | undefined>(undefined);
  const [kits, setKits] = useState<BrandKit[]>([]);
  const [savedTemplates, setSavedTemplates] = useState<SavedDeckTemplate[]>([]);
  /** Composing a kit inline, so a first deck for a new client is one screen. */
  const [composing, setComposing] = useState(false);
  const [kitName, setKitName] = useState('');
  const [kitAccent, setKitAccent] = useState(SUGGESTED[0]);
  /** The saved template pending delete confirmation, so the modal can name it. */
  const [pendingDeleteTemplate, setPendingDeleteTemplate] = useState<SavedDeckTemplate | null>(null);

  const allStarters: (DeckStarter & { custom?: boolean; savedId?: string })[] = useMemo(
    () => [...DECK_STARTERS, ...savedTemplates.map(starterFromTemplate)],
    [savedTemplates]
  );
  const activeStarter = allStarters.find((s) => s.id === starterId) ?? allStarters[0];

  useEffect(() => {
    if (!open) return;
    setName('');
    setStarterId(DECK_STARTERS[0].id);
    setThemeId(undefined);
    setKits(listBrandKits());
    setSavedTemplates(listDeckTemplates());
    setComposing(false);
    setKitName('');
    setKitAccent(SUGGESTED[0]);
  }, [open]);

  const removeTemplate = (savedId: string) => {
    deleteDeckTemplate(savedId);
    setSavedTemplates(listDeckTemplates());
    if (starterId === `custom:${savedId}`) setStarterId(DECK_STARTERS[0].id);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Back out of the kit form first, so one press cannot discard a half-typed
      // client and the whole screen together.
      if (composing) setComposing(false);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, composing]);

  const theme: DeckTheme = useMemo(() => {
    if (composing) {
      return {
        ...WOZKU_THEME,
        id: 'preview',
        name: kitName || 'New client',
        accent: accentRamp(isHex6(kitAccent) ? kitAccent.replace('#', '') : WOZKU_THEME.accent.base),
      };
    }
    return themeById(themeId, brandKitThemes(kits));
  }, [composing, kitName, kitAccent, themeId, kits]);

  // The starter's own cover, drawn through the real renderer in the chosen
  // colours. Both halves of the decision are visible in one object, which is the
  // whole reason they are on one screen. Memoised on the starter alone: the deck
  // is only built here to be looked at, and rebuilding it on every keystroke in
  // the name field would remount the preview under the cursor.
  const previewDeck = useMemo(() => activeStarter.build(), [activeStarter]);

  /**
   * A kit's typefaces have to be in the page before its cover is drawn.
   *
   * A kit carries type as well as colour now, so the preview beside these choices
   * is only truthful once those faces have arrived - otherwise picking a client
   * shows their colour on the house type and the deck looks different the moment
   * it opens.
   */
  useEffect(() => {
    void ensureFonts([theme.fonts.display.family, theme.fonts.sans.family, theme.fonts.mono.family]);
  }, [theme]);
  const cover = previewDeck.slides[0];

  if (!open) return null;

  const canCreateKit = kitName.trim().length > 0 && isHex6(kitAccent);

  const commitKit = () => {
    if (!canCreateKit) return;
    const kit = createBrandKit(kitName, kitAccent.replace('#', ''));
    setKits(listBrandKits());
    // Adopt it straight away. Making a kit inside this screen is how you say
    // "this deck is for this client"; asking you to then pick it out of the list
    // you just added it to would be a step that means nothing.
    setThemeId(kit.id);
    setComposing(false);
  };

  const create = () => {
    const deck = activeStarter.build();
    onCreate(name.trim() || 'Untitled deck', { ...deck, themeId });
    onClose();
  };

  const rowBase =
    'w-full flex items-center gap-3 px-3 py-2.5 text-left border transition-colors cursor-pointer';

  return createPortal(
    <>
    <div
      className="wg-overlay fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-label="New deck"
        className="wg-modal flex flex-col w-full max-w-[880px] max-h-[90vh] overflow-hidden my-auto bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex flex-col gap-1 px-5 py-4 border-b border-neutral-150 shrink-0">
          <div className="font-mono text-[9.5px] font-bold tracking-[0.16em] uppercase text-neutral-400">
            New deck
          </div>
          <h2 className="text-[17px] font-bold text-neutral-900">
            What are you building, and who for?
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3.5 right-3.5 w-7 h-7 flex items-center justify-center text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer"
          >
            <CloseIcon size={15} />
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col sm:flex-row">
          {/* ── The deck as it will arrive ─────────────────────────────────── */}
          <div className="sm:w-[292px] shrink-0 p-5 bg-neutral-50 border-b sm:border-b-0 sm:border-r border-neutral-150 flex flex-col gap-3">
            {cover && (
              <div style={{ boxShadow: '0 0 0 1px var(--neutral-200), 0 6px 20px -8px rgba(15,23,20,0.25)' }}>
                <FitStage slide={cover} ast={null} num="01" theme={theme} />
              </div>
            )}
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[12.5px] font-bold text-neutral-800">
                {activeStarter.name}
              </span>
              <span className="font-mono text-[10px] text-neutral-400">
                {previewDeck.slides.length} slide{previewDeck.slides.length === 1 ? '' : 's'}
              </span>
            </div>
            <p className="text-[11.5px] text-neutral-500 leading-relaxed">
              {activeStarter.description}
            </p>
            <div className="mt-auto flex items-center gap-2 pt-3 border-t border-neutral-200">
              <span
                className="shrink-0 w-[15px] h-[15px] border border-black/10"
                style={{ background: css(theme.accent.base) }}
              />
              <span className="text-[11.5px] font-semibold text-neutral-600 truncate">
                {theme.name}
              </span>
            </div>
          </div>

          {/* ── The two choices ───────────────────────────────────────────── */}
          <div className="flex-1 min-w-0 overflow-y-auto p-4 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[9.5px] font-bold tracking-[0.16em] uppercase text-neutral-400">
                Deck name
              </span>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !composing && create()}
                placeholder="Q3 Performance Review"
                className="h-[38px] px-3 text-[13px] border border-neutral-200 focus:border-emerald-500 outline-none text-neutral-900"
              />
            </label>

            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[9.5px] font-bold tracking-[0.16em] uppercase text-neutral-400">
                Start from
              </span>
              {allStarters.map((s) => {
                const active = s.id === starterId;
                return (
                  <button
                    key={s.id}
                    onClick={() => setStarterId(s.id)}
                    className={`${rowBase} items-start ${
                      active
                        ? 'border-emerald-500 bg-emerald-50/60'
                        : 'border-neutral-200 hover:border-neutral-400'
                    }`}
                  >
                    <span className="flex flex-col min-w-0 flex-1 gap-0.5">
                      <span
                        className={`text-[13px] ${
                          active ? 'font-bold text-emerald-800' : 'font-semibold text-neutral-800'
                        }`}
                      >
                        {s.name}
                        {s.custom && (
                          <span className="ml-1.5 font-mono text-[8.5px] font-bold tracking-[0.1em] uppercase text-neutral-400 align-middle">
                            Saved
                          </span>
                        )}
                      </span>
                      <span className="text-[11.5px] text-neutral-500 leading-snug">
                        {s.description}
                      </span>
                    </span>
                    {active && (
                      <span className="shrink-0 mt-0.5 text-emerald-600 flex items-center">
                        <CheckIcon size={15} />
                      </span>
                    )}
                    {s.custom && s.savedId && (
                      <span
                        role="button"
                        aria-label={`Delete template "${s.name}"`}
                        onClick={(e) => {
                          e.stopPropagation();
                          const saved = savedTemplates.find((t) => t.id === s.savedId);
                          if (saved) setPendingDeleteTemplate(saved);
                        }}
                        className="shrink-0 mt-0.5 text-neutral-300 hover:text-rose-600 flex items-center cursor-pointer"
                      >
                        <TrashIcon size={13} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[9.5px] font-bold tracking-[0.16em] uppercase text-neutral-400">
                Brand
              </span>

              {composing ? (
                /* A cut-down kit form, not the full manager. Everything here is
                   about getting one deck started, so it asks the two things a
                   kit needs and nothing else. Renaming, recolouring and deleting
                   kits stay in the brand kit screen, where the consequences for
                   other decks can be stated. */
                <div className="flex flex-col gap-2.5 p-3 border border-neutral-200 bg-neutral-50">
                  <input
                    autoFocus
                    value={kitName}
                    onChange={(e) => setKitName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && commitKit()}
                    placeholder="Client name"
                    className="h-[36px] px-3 text-[13px] border border-neutral-200 focus:border-emerald-500 outline-none text-neutral-900 bg-white"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={css(isHex6(kitAccent) ? kitAccent.replace('#', '') : WOZKU_THEME.accent.base)}
                      onChange={(e) => setKitAccent(e.target.value.replace('#', '').toUpperCase())}
                      aria-label="Pick brand colour"
                      className="w-[36px] h-[36px] p-0 border border-neutral-200 bg-white cursor-pointer"
                    />
                    <span className="flex items-center h-[36px] px-3 border border-neutral-200 bg-white focus-within:border-emerald-500">
                      <span className="font-mono text-[13px] text-neutral-400 pr-0.5">#</span>
                      <input
                        value={kitAccent.replace('#', '')}
                        onChange={(e) =>
                          setKitAccent(e.target.value.replace('#', '').toUpperCase().slice(0, 6))
                        }
                        onKeyDown={(e) => e.key === 'Enter' && commitKit()}
                        spellCheck={false}
                        className="w-[74px] font-mono text-[13px] outline-none text-neutral-900 uppercase bg-transparent"
                      />
                    </span>
                    <div className="flex items-center gap-1.5 ml-auto">
                      {SUGGESTED.map((hex) => (
                        <button
                          key={hex}
                          onClick={() => setKitAccent(hex)}
                          aria-label={`Use #${hex}`}
                          title={`#${hex}`}
                          className="w-5 h-5 border border-neutral-200 hover:scale-110 transition-transform cursor-pointer"
                          style={{ background: css(hex) }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={commitKit}
                      disabled={!canCreateKit}
                      className="h-[32px] px-3.5 text-[12px] font-bold text-white bg-neutral-900 hover:bg-neutral-800 transition-colors cursor-pointer disabled:bg-neutral-300 disabled:cursor-not-allowed"
                    >
                      Save client
                    </button>
                    <button
                      onClick={() => setComposing(false)}
                      className="h-[32px] px-3.5 text-[12px] font-bold text-neutral-700 border border-neutral-200 bg-white hover:bg-neutral-100 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {BUILT_IN_THEMES.map((t) => {
                    const id = t.id === WOZKU_THEME.id ? undefined : t.id;
                    const active = (themeId ?? WOZKU_THEME.id) === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setThemeId(id)}
                        className={`${rowBase} ${
                          active
                            ? 'border-emerald-500 bg-emerald-50/60'
                            : 'border-neutral-200 hover:border-neutral-400'
                        }`}
                      >
                        <span
                          className="shrink-0 w-[22px] h-[22px] border border-black/10"
                          style={{ background: css(t.accent.base) }}
                        />
                        <span
                          className={`flex-1 text-[13px] ${
                            active ? 'font-bold text-emerald-800' : 'font-semibold text-neutral-800'
                          }`}
                        >
                          {t.name}
                        </span>
                        <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.1em] text-neutral-400">
                          House
                        </span>
                        {active && (
                          <span className="shrink-0 text-emerald-600 flex items-center">
                            <CheckIcon size={15} />
                          </span>
                        )}
                      </button>
                    );
                  })}

                  {kits.map((kit) => {
                    const active = themeId === kit.id;
                    return (
                      <button
                        key={kit.id}
                        onClick={() => setThemeId(kit.id)}
                        className={`${rowBase} ${
                          active
                            ? 'border-emerald-500 bg-emerald-50/60'
                            : 'border-neutral-200 hover:border-neutral-400'
                        }`}
                      >
                        <span
                          className="shrink-0 w-[22px] h-[22px] border border-black/10"
                          style={{ background: css(kit.accent) }}
                        />
                        <span
                          className={`flex-1 min-w-0 truncate text-[13px] ${
                            active ? 'font-bold text-emerald-800' : 'font-semibold text-neutral-800'
                          }`}
                        >
                          {kit.name}
                        </span>
                        <span className="shrink-0 font-mono text-[10px] text-neutral-400">
                          #{kit.accent}
                        </span>
                        {active && (
                          <span className="shrink-0 text-emerald-600 flex items-center">
                            <CheckIcon size={15} />
                          </span>
                        )}
                      </button>
                    );
                  })}

                  <button
                    onClick={() => setComposing(true)}
                    className="flex items-center gap-2 px-3 py-2.5 border border-dashed border-neutral-300 text-[12.5px] font-bold text-neutral-700 hover:border-neutral-500 hover:bg-neutral-50 transition-colors cursor-pointer"
                  >
                    <AddIcon size={14} />
                    New client
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2.5 px-5 py-3.5 border-t border-neutral-150">
          <span className="text-[11px] text-neutral-400">
            Both choices can be changed later.
          </span>
          <div className="ml-auto flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="h-[38px] px-4 text-[12.5px] font-bold text-neutral-700 bg-white border border-neutral-200 hover:bg-neutral-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={create}
              disabled={composing}
              className="h-[38px] px-5 text-[12.5px] font-bold text-white bg-neutral-900 hover:bg-neutral-800 transition-colors cursor-pointer disabled:bg-neutral-300 disabled:cursor-not-allowed"
            >
              Create deck
            </button>
          </div>
        </div>
      </div>
    </div>
    <ConfirmModal
      open={pendingDeleteTemplate !== null}
      title={`Delete "${pendingDeleteTemplate?.name ?? 'this template'}"?`}
      message={cannotBeUndone('Decks already made from it are unaffected, but this saved template will be gone.')}
      onConfirm={() => {
        if (pendingDeleteTemplate) removeTemplate(pendingDeleteTemplate.id);
        setPendingDeleteTemplate(null);
      }}
      onCancel={() => setPendingDeleteTemplate(null)}
    />
    </>,
    document.body
  );
}
