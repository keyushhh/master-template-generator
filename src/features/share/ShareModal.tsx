import { useEffect, useRef, useState } from 'react';
import type { Collaborator, CollaboratorRole } from '../deck/deckStore';
import { CheckIcon, ChevronDownIcon, CloseIcon, LinkIcon } from '../ui/icons';
import { useFocusTrap } from '../a11y/useFocusTrap';
import { DEMO_USERS, findDemoUser, initialsOf, userById } from '../auth/demoUsers';
import { addNotification } from '../notifications/notificationStore';

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  deckName: string;
  onOpenExport: () => void;
  onOpenPresent: () => void;
  onShowToast: (msg: string, type: 'info' | 'success') => void;
  isSandbox?: boolean;
  onPromoteToRepository?: () => void;
  collaborators?: Collaborator[];
  ownerId?: string;
  currentUserId?: string;
  onInvite?: (userId: string, role: CollaboratorRole) => void;
  onRemoveCollaborator?: (userId: string) => void;
}

const ROLE_LABEL: Record<CollaboratorRole, string> = {
  editor: 'can edit',
  viewer: 'can view',
};

/**
 * The access menu, opening under whatever opened it.
 *
 * A native `select` cannot be styled and drew the platform's own popup, which
 * looked like it belonged to a different application than the rest of this
 * window.
 */
function RoleMenu({
  value,
  onChange,
  onRemove,
  label,
  compact,
}: {
  value: CollaboratorRole;
  onChange: (role: CollaboratorRole) => void;
  onRemove?: () => void;
  label: string;
  /** The pill inside the invite field, rather than a bare row label. */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      // Escape closes the menu without also closing the window behind it.
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  const row =
    'w-full flex items-center gap-2 px-3 py-[7px] text-[12.5px] font-medium transition-colors cursor-pointer text-left';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={
          compact
            ? 'flex items-center gap-1 h-7 pl-2 pr-1.5 bg-neutral-100 hover:bg-neutral-200 rounded-[var(--radius-sharp)] text-[12px] font-semibold text-neutral-700 cursor-pointer transition-colors'
            : 'flex items-center gap-1 text-[12.5px] font-semibold text-neutral-600 hover:text-neutral-900 cursor-pointer transition-colors'
        }
      >
        {ROLE_LABEL[value]}
        <ChevronDownIcon size={12} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+6px)] z-30 w-[168px] py-1 bg-white border border-neutral-200 text-left rounded-[var(--radius-sharp)]"
          style={{ boxShadow: '0 10px 30px -8px rgba(15,23,20,0.28)' }}
        >
          {(['editor', 'viewer'] as CollaboratorRole[]).map((role) => (
            <button
              key={role}
              role="menuitem"
              type="button"
              onClick={() => { onChange(role); setOpen(false); }}
              className={`${row} text-neutral-700 hover:bg-neutral-100`}
            >
              <span className="w-3.5 shrink-0 text-neutral-900">
                {value === role && <CheckIcon size={13} />}
              </span>
              {ROLE_LABEL[role]}
            </button>
          ))}
          {onRemove && (
            <>
              <div className="my-1 border-t border-neutral-200" />
              <button
                role="menuitem"
                type="button"
                onClick={() => { onRemove(); setOpen(false); }}
                className={`${row} text-rose-600 hover:bg-rose-50`}
              >
                <span className="w-3.5 shrink-0" />
                Remove
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Row({
  color,
  name,
  email,
  you,
  children,
}: {
  color: string;
  name: string;
  email: string;
  you: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span
        className="w-8 h-8 shrink-0 flex items-center justify-center text-[10px] font-mono font-bold text-white"
        style={{ backgroundColor: color }}
      >
        {initialsOf(name)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-neutral-900 truncate">
          {name}
          {you && <span className="text-neutral-600 font-normal"> (you)</span>}
        </div>
        <div className="text-[11.5px] text-neutral-600 truncate">{email}</div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function ShareModal({
  open,
  onClose,
  deckName,
  onOpenExport,
  onShowToast,
  isSandbox,
  onPromoteToRepository,
  collaborators = [],
  ownerId,
  currentUserId,
  onInvite,
  onRemoveCollaborator,
}: ShareModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<CollaboratorRole>('editor');
  const [inviteError, setInviteError] = useState<string | null>(null);

  useFocusTrap(containerRef, open);
  if (!open) return null;

  const isOwner = !ownerId || ownerId === currentUserId;
  const owner = userById(ownerId);
  const presentUrl = `${window.location.origin}${window.location.pathname}?present=true`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(presentUrl);
      onShowToast('Presenter link copied.', 'success');
    } catch {
      onShowToast('Could not copy the link.', 'info');
    }
  };

  const submitInvite = (e: React.FormEvent) => {
    e.preventDefault();
    const match = findDemoUser(inviteEmail);
    // Without a backend there is nobody to send an invitation to, so an unknown
    // address is a dead end rather than a pending invite.
    if (!match) {
      setInviteError('No Studio account uses that email.');
      return;
    }
    if (match.id === ownerId) {
      setInviteError('They already own this deck.');
      return;
    }
    onInvite?.(match.id, inviteRole);
    if (currentUserId) {
      const sender = userById(currentUserId);
      if (sender) {
        addNotification(match.id, {
          authorName: sender.name,
          authorColor: sender.color,
          type: inviteRole === 'editor' ? 'invite_edit' : 'invite_view',
          title: `${sender.name} invited you to ${inviteRole === 'editor' ? 'edit' : 'view'}`,
          description: `You have been added as an ${inviteRole === 'editor' ? 'Editor' : 'Viewer'} on "${deckName}".`,
          deckName: deckName,
        });
      }
    }
    onShowToast(`${match.name} can now ${inviteRole === 'editor' ? 'edit' : 'view'} this deck.`, 'success');
    setInviteEmail('');
    setInviteError(null);
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs"
      // Only a press that both starts and ends on the backdrop closes it, so a
      // drag that began inside the window does not dismiss it on release.
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={containerRef}
        className="w-full max-w-[460px] bg-white border border-neutral-200 shadow-2xl rounded-[var(--radius-sharp)] animate-in fade-in zoom-in-95 duration-120"
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-200">
          <h2
            className="text-[15px] font-bold text-neutral-900 tracking-[-0.01em] truncate"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Share {deckName}
          </h2>
          <div className="flex items-center gap-3 shrink-0 pl-3">
            <button
              type="button"
              onClick={copyLink}
              className="flex items-center gap-1.5 text-[12.5px] font-semibold text-neutral-600 hover:text-neutral-900 transition-colors cursor-pointer"
            >
              <LinkIcon size={14} />
              Copy link
            </button>
            <button
              onClick={onClose}
              aria-label="Close Share dialog"
              className="text-neutral-600 hover:text-neutral-900 transition-colors cursor-pointer"
            >
              <CloseIcon size={16} />
            </button>
          </div>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <form onSubmit={submitInvite} className="flex items-center gap-2">
              <div
                className={`flex-1 flex items-center h-9 pl-3 pr-1 bg-white border rounded-[var(--radius-sharp)] transition-colors ${
                  isOwner ? 'border-neutral-200 focus-within:border-neutral-900' : 'border-neutral-200 bg-neutral-100'
                }`}
              >
                <input
                  type="email"
                  list="wozku-share-people"
                  value={inviteEmail}
                  onChange={(e) => { setInviteEmail(e.target.value); setInviteError(null); }}
                  placeholder="Invite by email"
                  disabled={!isOwner}
                  className="flex-1 min-w-0 bg-transparent border-none outline-none text-[12.5px] text-neutral-900 disabled:text-neutral-600 placeholder:text-neutral-600"
                />
                {inviteEmail.trim() && (
                  <div className="shrink-0">
                    <RoleMenu
                      value={inviteRole}
                      label="Invite as"
                      onChange={setInviteRole}
                      compact
                    />
                  </div>
                )}
              </div>
              <datalist id="wozku-share-people">
                {DEMO_USERS.filter((u) => u.id !== ownerId).map((u) => (
                  <option key={u.id} value={u.email}>{u.name}</option>
                ))}
              </datalist>
              <button
                type="submit"
                disabled={!isOwner}
                className="h-9 px-4 text-[12.5px] font-bold text-white bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-600 disabled:cursor-not-allowed rounded-[var(--radius-sharp)] transition-colors cursor-pointer shrink-0"
              >
                Invite
              </button>
            </form>
            {inviteError && (
              <span role="alert" className="text-[11.5px] font-semibold text-rose-700">{inviteError}</span>
            )}
            {!isOwner && (
              <span className="text-[11.5px] text-neutral-600">
                Only {owner?.name ?? 'the owner'} can change who has access.
              </span>
            )}
          </div>

          <div className="flex flex-col">
            <span className="text-[12.5px] font-semibold text-neutral-600 pb-1">Who has access</span>

            {owner && (
              <Row
                color={owner.color}
                name={owner.name}
                email={owner.email}
                you={owner.id === currentUserId}
              >
                <span className="text-[12.5px] font-semibold text-neutral-600">owner</span>
              </Row>
            )}

            {collaborators.map((c) => {
              const person = userById(c.userId);
              if (!person) return null;
              return (
                <Row
                  key={c.userId}
                  color={person.color}
                  name={person.name}
                  email={person.email}
                  you={person.id === currentUserId}
                >
                  {isOwner ? (
                    <RoleMenu
                      value={c.role}
                      label={`Access for ${person.name}`}
                      onChange={(role) => onInvite?.(c.userId, role)}
                      onRemove={() => {
                        onRemoveCollaborator?.(c.userId);
                        onShowToast(`Removed ${person.name} from this deck.`, 'info');
                      }}
                    />
                  ) : (
                    <span className="text-[12.5px] font-semibold text-neutral-600">
                      {c.role === 'editor' ? 'can edit' : 'can view'}
                    </span>
                  )}
                </Row>
              );
            })}

            {!collaborators.length && (
              <p className="text-[11.5px] text-neutral-600 py-1.5">
                Nobody else has been invited yet.
              </p>
            )}
          </div>

          {isSandbox && onPromoteToRepository && (
            <div className="flex items-center justify-between gap-3 pt-1">
              <span className="text-[12px] text-neutral-600">
                This deck is hidden from the Team Repository.
              </span>
              <button
                type="button"
                onClick={() => {
                  onPromoteToRepository();
                  onShowToast('Saved to the Team Repository.', 'success');
                }}
                className="shrink-0 text-[12.5px] font-bold text-neutral-900 hover:underline cursor-pointer"
              >
                Save to repository
              </button>
            </div>
          )}

        </div>

        <div className="flex items-center justify-between px-5 py-3.5 border-t border-neutral-200">
          <span className="text-[12.5px] text-neutral-600">Need a file to send on?</span>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenExport();
            }}
            className="text-[12.5px] font-bold text-neutral-900 hover:underline cursor-pointer"
          >
            Export PowerPoint or PDF →
          </button>
        </div>
      </div>
    </div>
  );
}
