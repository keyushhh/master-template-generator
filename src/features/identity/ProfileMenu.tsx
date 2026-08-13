import { useEffect, useRef, useState } from 'react';
import {
  AVAILABLE_WORKSPACES,
  getInitials,
  loadUserProfile,
  saveUserProfile,
  type UserProfile,
  type WorkspaceOption,
} from './profileStore';
import { WorkspaceSwitchModal } from './WorkspaceSwitchModal';
import { CloseIcon } from '../ui/icons';

export function ProfileMenu() {
  const [profile, setProfile] = useState<UserProfile>(loadUserProfile);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(profile.name);
  const [editEmail, setEditEmail] = useState(profile.email);
  const [pendingWorkspace, setPendingWorkspace] = useState<WorkspaceOption | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setEditing(false);
      }
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  const activeWorkspace =
    AVAILABLE_WORKSPACES.find((w) => w.id === profile.workspaceId) ?? AVAILABLE_WORKSPACES[0];

  const handleSelectWorkspace = (ws: WorkspaceOption) => {
    if (ws.id === activeWorkspace.id) return;
    setOpen(false);
    setPendingWorkspace(ws);
  };

  const confirmWorkspaceSwitch = () => {
    if (!pendingWorkspace) return;
    const updated = saveUserProfile({
      workspaceId: pendingWorkspace.id,
      workspaceName: pendingWorkspace.name,
    });
    setProfile(updated);
    setPendingWorkspace(null);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = saveUserProfile({ name: editName, email: editEmail });
    setProfile(updated);
    setEditing(false);
  };

  const initials = getInitials(profile.name);

  return (
    <div ref={menuRef} className="relative inline-block text-left">
      {/* Avatar Trigger Button - 0px sharp corners */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={`${profile.name} (${profile.workspaceName}): ${activeWorkspace.badge}`}
        className="flex items-center gap-2 h-[34px] px-2 border border-neutral-200 bg-white hover:bg-neutral-50 rounded-none transition-colors cursor-pointer outline-none focus:border-neutral-900"
      >
        <span
          className="w-6 h-6 rounded-none flex items-center justify-center text-[10.5px] font-mono font-bold text-white select-none shrink-0"
          style={{ backgroundColor: profile.avatarColor }}
        >
          {initials}
        </span>
        <span className="hidden md:inline-block text-[12px] font-bold text-neutral-800 max-w-[110px] truncate">
          {profile.name}
        </span>
        <span className="text-[10px] font-mono text-neutral-400 font-semibold uppercase">
          {activeWorkspace.kind === 'personal' ? 'P' : 'T'}
        </span>
      </button>

      {/* Popover Menu - 0px sharp corners */}
      {open && (
        <div className="absolute right-0 mt-2 w-84 bg-white border border-neutral-200 shadow-2xl rounded-none overflow-hidden z-[200] animate-in fade-in zoom-in-95 duration-100">
          {/* Header & Identity */}
          <div className="p-4 border-b border-neutral-200 bg-neutral-50/80 flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span
                className="w-9 h-9 rounded-none flex items-center justify-center text-[12px] font-mono font-bold text-white shadow-xs select-none"
                style={{ backgroundColor: profile.avatarColor }}
              >
                {initials}
              </span>
              <div>
                <h4 className="text-[13.5px] font-bold text-neutral-900 leading-tight">
                  {profile.name}
                </h4>
                <p className="text-[11.5px] text-neutral-500 truncate max-w-[190px]">
                  {profile.email}
                </p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-neutral-400 hover:text-neutral-800 p-1 cursor-pointer"
            >
              <CloseIcon size={14} />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 flex flex-col gap-3.5">
            {/* Workspace Selector */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                Active Workspace
              </span>
              <div className="flex flex-col gap-1 border border-neutral-200 rounded-none p-1 bg-neutral-50/50">
                {AVAILABLE_WORKSPACES.map((ws) => {
                  const selected = ws.id === activeWorkspace.id;
                  return (
                    <button
                      key={ws.id}
                      type="button"
                      onClick={() => handleSelectWorkspace(ws)}
                      className={`w-full px-2.5 py-1.5 rounded-none text-left flex items-center justify-between text-[12px] transition-colors cursor-pointer ${
                        selected
                          ? 'bg-neutral-900 text-white font-bold'
                          : 'hover:bg-neutral-200/60 text-neutral-700 font-medium'
                      }`}
                    >
                      <span className="truncate">{ws.name}</span>
                      <span
                        className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-none shrink-0 ${
                          selected
                            ? 'bg-neutral-700 text-emerald-300'
                            : 'bg-neutral-200/80 text-neutral-600'
                        }`}
                      >
                        {ws.kind === 'personal' ? 'Personal' : `${ws.membersCount} members`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Privacy & Workspace Status Badge */}
            {activeWorkspace.kind === 'personal' ? (
              <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-none flex items-start gap-2.5">
                <span className="text-[15px] select-none">🔒</span>
                <div className="text-[11.5px] leading-relaxed text-emerald-950">
                  <strong className="font-bold block text-emerald-900">Personal & 100% Local</strong>
                  Decks are stored locally in this browser. No cloud syncing or third-party servers.
                </div>
              </div>
            ) : (
              <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-none flex items-start gap-2.5">
                <span className="text-[15px] select-none">👥</span>
                <div className="text-[11.5px] leading-relaxed text-blue-950">
                  <strong className="font-bold block text-blue-900">Shared Team Workspace</strong>
                  Synchronized with {activeWorkspace.membersCount} team members in {activeWorkspace.name}. Shared brand kits & team templates active.
                </div>
              </div>
            )}

            {/* Profile Editing Form or Edit Action */}
            {editing ? (
              <form onSubmit={handleSaveProfile} className="pt-2 flex flex-col gap-2.5 border-t border-neutral-200">
                <div>
                  <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full h-8 px-2.5 text-[12.5px] bg-neutral-50 border border-neutral-200 rounded-none text-neutral-900 focus:bg-white focus:border-neutral-900 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full h-8 px-2.5 text-[12.5px] bg-neutral-50 border border-neutral-200 rounded-none text-neutral-900 focus:bg-white focus:border-neutral-900 outline-none"
                    required
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="px-2.5 h-7 text-[11.5px] font-semibold text-neutral-600 hover:bg-neutral-100 rounded-none transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 h-7 text-[11.5px] font-bold text-white bg-neutral-900 hover:bg-neutral-800 rounded-none transition-colors cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setEditName(profile.name);
                  setEditEmail(profile.email);
                  setEditing(true);
                }}
                className="w-full h-8 text-[12px] font-bold text-neutral-800 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-none transition-colors cursor-pointer text-center"
              >
                Edit Profile Settings
              </button>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Modal before workspace switch */}
      <WorkspaceSwitchModal
        open={Boolean(pendingWorkspace)}
        onClose={() => setPendingWorkspace(null)}
        targetWorkspace={pendingWorkspace}
        onConfirm={confirmWorkspaceSwitch}
      />
    </div>
  );
}
