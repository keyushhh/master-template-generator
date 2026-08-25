/**
 * The floating studio header.
 *
 * Replaces two detached clusters of square buttons (an Edit/Reset/Undo row
 * pinned to the slide's left edge, and a lone Present button in the top-right
 * corner) with one glassmorphic bar that spans the canvas.
 *
 * Three regions, left to right:
 *
 *  - Identity: the project title, editable in place, with a live persistence
 *    badge under it. Previously the deck's name was only visible in the
 *    sidebar's switcher, so the canvas itself never told you what you had open.
 *  - Mode: a segmented View / Edit / Present control. The old UI expressed the
 *    same three states as unrelated controls in different corners, which gave
 *    no sense that they are one axis you move along.
 *  - Actions: undo/redo, Reset, and the session's Save/Discard while editing.
 *
 * Present is momentary rather than sticky - it opens the fullscreen overlay and
 * the segment springs back to whatever mode you were in when the overlay
 * closes, because the overlay is a view of the deck rather than a third editing
 * state of it.
 */

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ProjectMeta } from '../deck/deckStore';
import { DeckSwitcher } from './DeckSwitcher';
import logoBlack from '../../assets/wozku-logo-black.svg';
import {
  ChatIcon,
  CommentIcon,
  DownloadIcon,
  EyeIcon,
  EyeOffIcon,
  HistoryIcon,
  RedoIcon,
  RefreshIcon,
  ShareIcon,
  UndoIcon,
} from '../ui/icons';
import { PresenceStack } from '../collab/PresenceStack';
import type { CollabPeer } from '../collab/collabChannel';

export type StudioMode = 'view' | 'edit';

interface StudioHeaderProps {
  projectName: string;
  onRenameProject: (name: string) => void;
  /** Which mode the segmented control shows as current. */
  mode: StudioMode;
  /** True while the fullscreen present overlay is up - lights the Present
   *  segment for as long as it lasts. */
  presenting: boolean;
  /** Unsaved edits exist on the draft. Drives the badge and Save's emphasis. */
  dirty: boolean;
  onEnterEdit: () => void;
  /** Leave edit mode, keeping the edits. */
  onExitEdit: () => void;
  onDiscard: () => void;
  onPresent: () => void;
  canPresent: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  canReset: boolean;
  resetArmed: boolean;
  onResetClick: () => void;
  /** Opens the Export sheet. Lives here rather than in the sidebar: it is an
   *  output action, and Present - the other one - is already here. */
  onOpenReview: () => void;
  canExport: boolean;
  onOpenShare?: () => void;
  onOpenHistory?: () => void;
  /** Whether comment pins are visible on the canvas */
  showComments?: boolean;
  onToggleShowComments?: () => void;
  openCommentsCount?: number;
  /** Everyone else with this deck open, shown as avatars beside the actions. */
  peers?: CollabPeer[];
  /** Jump to the slide a peer is on. */
  onFollowPeer?: (slideId: string) => void;
  /** Slides a peer can actually be followed to. */
  reachableSlideIds?: Set<string>;
  /** False for someone invited to view: the Edit tab is theirs to see, not use. */
  canEditDeck?: boolean;
  /** Deck management, moved here from under the sidebar logo so the deck you
   *  have open and its name live in the same place. */
  projects: ProjectMeta[];
  activeId: string | null;
  onSwitchDeck: (id: string) => void;
  onNewDeck: () => void;
  onRenameDeck: (id: string, name: string) => void;
  onDeleteDeck: (id: string) => void;
}

const MODES: { id: 'view' | 'edit' | 'present'; label: string }[] = [
  { id: 'view', label: 'View' },
  { id: 'edit', label: 'Edit' },
  { id: 'present', label: 'Present' },
];

/** One segment's width. Fixed rather than content-derived so the sliding
 *  indicator can be positioned with pure arithmetic - measuring three tabs to
 *  animate between them would re-measure on every render for no gain. */
const SEG_W = 78;

function IconBtn({
  onClick,
  disabled,
  title,
  label,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  title: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={label}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 30,
        height: 30,
        borderRadius: 'var(--radius-sharp)',
        border: '1px solid var(--neutral-200)',
        background: 'transparent',
        color: 'var(--neutral-700)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.35 : 1,
        transition: 'background .15s, border-color .15s, color .15s',
        padding: 0,
      }}
      className="hover:border-neutral-400 hover:text-neutral-900"
    >
      {children}
    </button>
  );
}

export function StudioHeader({
  projectName,
  onRenameProject,
  mode,
  presenting,
  dirty,
  onEnterEdit,
  onExitEdit,
  onDiscard,
  onPresent,
  canPresent,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  canReset,
  resetArmed,
  onResetClick,
  onOpenReview,
  canExport,
  onOpenShare,
  onOpenHistory,
  showComments = true,
  onToggleShowComments,
  openCommentsCount = 0,
  peers = [],
  onFollowPeer,
  reachableSlideIds,
  canEditDeck = true,
  projects,
  activeId,
  onSwitchDeck,
  onNewDeck,
  onRenameDeck,
  onDeleteDeck,
}: StudioHeaderProps) {
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(projectName);
  const [titleHover, setTitleHover] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming) inputRef.current?.select();
  }, [renaming]);

  const commitRename = () => {
    const clean = draftName.trim();
    if (clean && clean !== projectName) onRenameProject(clean);
    setRenaming(false);
  };

  /** Which segment reads as current. Present wins while its overlay is up, so
   *  the control agrees with what fills the screen. */
  const activeIndex = presenting ? 2 : mode === 'edit' ? 1 : 0;

  const selectMode = (id: 'view' | 'edit' | 'present') => {
    if (id === 'present') {
      if (canPresent) onPresent();
      return;
    }
    if (id === 'edit' && mode !== 'edit') onEnterEdit();
    // Leaving edit mode keeps the edits rather than dropping them: undo still
    // reaches back through them, and Discard is right there for the other
    // intent. Silently throwing away work on a mode change would be the one
    // unrecoverable thing this control could do.
    if (id === 'view' && mode === 'edit') onExitEdit();
  };

  return (
    <header
      style={{
        position: 'fixed',
        top: 12,
        // Spans the full window above both the rail and the stage.
        left: 16,
        right: 16,
        // Above the floating rail and CTA (both z-index 100). The header spans
        // the full width over them, and its own backdrop-filter makes it a
        // stacking context - so the deck menu inside it cannot escape this
        // value however high its own z-index is.
        zIndex: 110,
        display: 'flex',
        alignItems: 'center',
        // The mode control is absolutely positioned (see below), so it takes
        // no space in this row - space-between is what keeps identity and
        // actions pinned to the two ends instead of collapsing together.
        justifyContent: 'space-between',
        gap: 16,
        height: 56,
        padding: '0 10px 0 16px',
        // The mode control below is positioned absolutely against this box
        // (see its own `position: absolute; left: 50%`), not centred by flex
        // `margin: auto` - the action cluster on the right grows when
        // Save/Discard appear in edit mode, which used to shift the "centred"
        // flex position and made the toggle visibly slide sideways on every
        // mode change.
        borderRadius: 'var(--radius-sharp)',
        background: '#fff',
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: 'var(--neutral-200)',
        boxShadow: '0 1px 2px rgba(15,23,20,0.05)',
      }}
    >
      {/* ── Brand + identity ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, flexShrink: 1 }}>
        <Link
          to="/"
          title="All decks"
          aria-label="All decks"
          style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}
        >
          <img
            src={logoBlack}
            alt="Wozku"
            style={{ height: 20, width: 'auto', flexShrink: 0, userSelect: 'none' }}
            draggable={false}
          />
        </Link>
        <span style={{ width: 1, height: 26, background: 'var(--neutral-200)', flexShrink: 0 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        {renaming ? (
          <input
            ref={inputRef}
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') { setDraftName(projectName); setRenaming(false); }
            }}
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 14.5,
              fontWeight: 700,
              letterSpacing: '-0.01em',
              color: 'var(--neutral-900)',
              background: '#fff',
              borderWidth: 1,
              borderStyle: 'solid',
              borderColor: 'var(--emerald-400)',
              borderRadius: 'var(--radius-sharp)',
              padding: '2px 6px',
              margin: '-3px -7px',
              outline: 'none',
              minWidth: 0,
              width: 200,
            }}
          />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
          <button
            onClick={() => { setDraftName(projectName); setRenaming(true); }}
            onMouseEnter={() => setTitleHover(true)}
            onMouseLeave={() => setTitleHover(false)}
            title="Click to rename this deck"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 14.5,
              fontWeight: 700,
              letterSpacing: '-0.01em',
              color: 'var(--neutral-900)',
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              textAlign: 'left',
              maxWidth: 260,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              // Underline on hover only, so the title is a heading at rest and
              // advertises itself as editable exactly when reachable.
              borderBottom: `1px solid ${titleHover ? 'var(--neutral-300)' : 'transparent'}`,
              transition: 'border-color .15s',
            }}
          >
            {projectName}
          </button>
          <DeckSwitcher
            variant="header"
            projects={projects}
            activeId={activeId}
            onSwitch={onSwitchDeck}
            onNew={onNewDeck}
            onRename={onRenameDeck}
            onDelete={onDeleteDeck}
          />
          </div>
        )}

        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 11,
            color: dirty ? 'var(--emerald-600)' : 'var(--neutral-400)',
            whiteSpace: 'nowrap',
          }}
        >
          {dirty && (
            <span
              className="wg-pulse"
              style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--emerald-500)', flexShrink: 0 }}
            />
          )}
          {dirty ? 'Unsaved changes' : 'Saved locally'}
        </span>
        </div>
      </div>

      {/* ── Mode: segmented control ──────────────────────────────────────────
          Centred against the header's own box via absolute positioning, not
          flex `margin: auto` - see the note on the header's style above for
          why that matters. */}
      <div
        role="tablist"
        aria-label="Deck mode"
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          padding: 3,
          borderRadius: 'var(--radius-sharp)',
          background: 'var(--neutral-100)',
          flexShrink: 0,
        }}
      >
        {/* Sliding card. One moving element rather than a per-tab background,
            so the active state travels instead of blinking between tabs. */}
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: 3,
            left: 3,
            width: SEG_W,
            height: 28,
            borderRadius: 'var(--radius-sharp)',
            background: '#fff',
            boxShadow: '0 1px 2px rgba(15,23,20,0.06), 0 2px 6px -2px rgba(15,23,20,0.12)',
            transform: `translateX(${activeIndex * SEG_W}px)`,
            transition: 'transform .22s cubic-bezier(.4,0,.2,1)',
          }}
        />
        {MODES.map((m, i) => {
          const active = i === activeIndex;
          const disabled = (m.id === 'present' && !canPresent) || (m.id === 'edit' && !canEditDeck);
          return (
            <button
              key={m.id}
              role="tab"
              aria-selected={active}
              disabled={disabled}
              title={m.id === 'edit' && !canEditDeck ? 'You have view access to this deck' : undefined}
              onClick={() => selectMode(m.id)}
              style={{
                position: 'relative',
                zIndex: 1,
                width: SEG_W,
                height: 28,
                border: 'none',
                background: 'transparent',
                borderRadius: 'var(--radius-sharp)',
                fontFamily: 'var(--font-sans)',
                fontSize: 12,
                fontWeight: active ? 700 : 600,
                color: disabled
                  ? 'var(--neutral-300)'
                  : active
                    ? 'var(--neutral-900)'
                    : 'var(--neutral-500)',
                cursor: disabled ? 'not-allowed' : 'pointer',
                transition: 'color .15s, font-weight .15s',
                padding: 0,
              }}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {/* ── Actions ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        {peers.length > 0 && (
          <>
            <PresenceStack peers={peers} onFollow={onFollowPeer} reachableSlideIds={reachableSlideIds} />
            <span style={{ width: 1, height: 20, background: 'var(--neutral-200)', margin: '0 6px' }} />
          </>
        )}
        <IconBtn onClick={onUndo} disabled={!canUndo} title="Undo (⌘Z)" label="Undo">
          <UndoIcon size={16} />
        </IconBtn>
        <IconBtn onClick={onRedo} disabled={!canRedo} title="Redo (⌘⇧Z)" label="Redo">
          <RedoIcon size={16} />
        </IconBtn>

        <button
          onClick={onResetClick}
          disabled={!canReset}
          title="Revert the deck to its imported baseline"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            height: 30,
            padding: '0 11px',
            borderRadius: 'var(--radius-sharp)',
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: resetArmed ? '#fecaca' : 'transparent',
            background: resetArmed ? '#fef2f2' : 'transparent',
            color: resetArmed ? '#dc2626' : canReset ? 'var(--neutral-600)' : 'var(--neutral-300)',
            fontSize: 12,
            fontWeight: 600,
            cursor: canReset ? 'pointer' : 'not-allowed',
            transition: 'background .15s, color .15s, border-color .15s',
            whiteSpace: 'nowrap',
          }}
        >
          {!resetArmed && <RefreshIcon size={14} />}
          {resetArmed ? 'Confirm reset?' : 'Reset'}
        </button>

        <IconBtn onClick={() => onOpenHistory?.()} title="Version history" label="Version history">
          <HistoryIcon size={15} />
        </IconBtn>

        {/* Single Comments Toggle Icon Button */}
        {onToggleShowComments && (
          <div style={{ position: 'relative' }}>
            <IconBtn
              onClick={onToggleShowComments}
              title={showComments ? 'Hide comments (⇧C)' : 'Show comments (⇧C)'}
              label="Comments"
            >
              <ChatIcon size={15} />
            </IconBtn>
            {openCommentsCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  minWidth: 15,
                  height: 15,
                  padding: '0 3.5px',
                  borderRadius: 8,
                  backgroundColor: '#0D99FF',
                  color: '#ffffff',
                  fontSize: '9px',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                }}
              >
                {openCommentsCount}
              </span>
            )}
          </div>
        )}

        <button
          onClick={() => onOpenShare?.()}
          title="Invite people to this deck"
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            height: 30, padding: '0 11px',
            borderRadius: 'var(--radius-sharp)',
            border: '1px solid var(--neutral-200)',
            background: 'transparent',
            color: 'var(--neutral-700)',
            fontSize: 12, fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'background .15s, border-color .15s',
          }}
        >
          <ShareIcon size={14} />
          Share
        </button>

        <button
          onClick={() => canExport && onOpenReview()}
          disabled={!canExport}
          title="Preview every slide, then export PPTX / PDF / PNG / Wozku deck"
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            height: 30, padding: '0 13px',
            borderRadius: 'var(--radius-sharp)',
            border: 'none',
            background: canExport ? 'var(--neutral-900)' : 'var(--neutral-200)',
            color: canExport ? '#fff' : 'var(--neutral-400)',
            fontSize: 12, fontWeight: 700,
            cursor: canExport ? 'pointer' : 'not-allowed',
            whiteSpace: 'nowrap',
            transition: 'background .15s',
          }}
        >
          <DownloadIcon size={14} />
          Export
        </button>

        {/* Session actions. Present only while the deck is forked, so the bar
            has a fixed shape the rest of the time. */}
        {mode === 'edit' && (
          <>
            <button
              onClick={onExitEdit}
              title="Keep these edits and return to view mode"
              style={{
                height: 30,
                padding: '0 14px',
                borderRadius: 'var(--radius-sharp)',
                border: 'none',
                cursor: 'pointer',
                background: dirty ? 'var(--neutral-900)' : 'var(--neutral-200)',
                color: dirty ? '#fff' : 'var(--neutral-500)',
                fontSize: 12,
                fontWeight: 700,
                whiteSpace: 'nowrap',
                transition: 'background .15s, color .15s',
              }}
            >
              Save
            </button>
            <button
              onClick={onDiscard}
              title={dirty ? 'Throw away every change since you entered edit mode' : 'Leave edit mode'}
              style={{
                height: 30,
                padding: '0 12px',
                borderRadius: 'var(--radius-sharp)',
                borderWidth: 1,
                borderStyle: 'solid',
                borderColor: 'var(--neutral-200)',
                background: '#fff',
                color: 'var(--neutral-600)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {dirty ? 'Discard' : 'Done'}
            </button>
          </>
        )}
      </div>
    </header>
  );
}
