import { createPortal } from 'react-dom';
import type { WorkspaceOption } from './profileStore';
import { CloseIcon, LockIcon, PeopleIcon } from '../ui/icons';

interface WorkspaceSwitchModalProps {
  open: boolean;
  onClose: () => void;
  targetWorkspace: WorkspaceOption | null;
  onConfirm: () => void;
}

export function WorkspaceSwitchModal({
  open,
  onClose,
  targetWorkspace,
  onConfirm,
}: WorkspaceSwitchModalProps) {
  if (!open || !targetWorkspace) return null;

  const isSwitchingToTeam = targetWorkspace.kind === 'team';

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-neutral-900/40 backdrop-blur-xs animate-in fade-in duration-120"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[440px] bg-white border border-neutral-200/80 shadow-2xl rounded-none overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-neutral-100 flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[9px] font-bold tracking-[0.16em] uppercase text-neutral-400">
              Workspace Switcher
            </span>
            <h3 className="text-[14.5px] font-bold text-neutral-900 leading-none">
              Confirm Active Workspace
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="text-neutral-400 hover:text-neutral-800 p-1 cursor-pointer transition-colors"
          >
            <CloseIcon size={14} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-4">
          <p className="text-[12.5px] text-neutral-500 leading-normal">
            You are switching your active environment. Review the destination settings below:
          </p>

          {isSwitchingToTeam ? (
            <div className="border border-neutral-200 bg-neutral-50/50 p-4 flex flex-col gap-3.5">
              <div className="flex justify-between items-center text-[10px] font-mono tracking-wider text-neutral-400 uppercase">
                <span>Destination Type</span>
                <span className="px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-200/60 font-sans font-bold">
                  Shared Team
                </span>
              </div>

              <div className="flex items-center gap-3 py-1">
                <span className="w-9 h-9 flex items-center justify-center bg-blue-100/60 text-blue-700 shrink-0">
                  <PeopleIcon size={18} />
                </span>
                <div>
                  <h4 className="text-[13px] font-bold text-neutral-900 leading-tight">
                    {targetWorkspace.name}
                  </h4>
                  <p className="text-[11.5px] text-neutral-500 mt-0.5">
                    Accessible to {targetWorkspace.membersCount ?? 'team'} members
                  </p>
                </div>
              </div>

              <div className="border-t border-neutral-200/60 pt-3.5 flex flex-col gap-2.5">
                <div className="flex gap-2.5 items-start text-[11.5px] leading-relaxed text-neutral-600">
                  <span className="text-emerald-600 shrink-0 font-bold select-none">✓</span>
                  <span>Brand kits and shared team templates will activate automatically.</span>
                </div>
                <div className="flex gap-2.5 items-start text-[11.5px] leading-relaxed text-neutral-600">
                  <span className="text-emerald-600 shrink-0 font-bold select-none">✓</span>
                  <span>Your personal decks remain private and secure on this device.</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="border border-neutral-200 bg-neutral-50/50 p-4 flex flex-col gap-3.5">
              <div className="flex justify-between items-center text-[10px] font-mono tracking-wider text-neutral-400 uppercase">
                <span>Destination Type</span>
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200/60 font-sans font-bold">
                  Private (Local)
                </span>
              </div>

              <div className="flex items-center gap-3 py-1">
                <span className="w-9 h-9 flex items-center justify-center bg-emerald-100/60 text-emerald-700 shrink-0">
                  <LockIcon size={18} />
                </span>
                <div>
                  <h4 className="text-[13px] font-bold text-neutral-900 leading-tight">
                    {targetWorkspace.name}
                  </h4>
                  <p className="text-[11.5px] text-neutral-500 mt-0.5">
                    On-device secure storage sandbox
                  </p>
                </div>
              </div>

              <div className="border-t border-neutral-200/60 pt-3.5 flex flex-col gap-2.5">
                <div className="flex gap-2.5 items-start text-[11.5px] leading-relaxed text-neutral-600">
                  <span className="text-emerald-600 shrink-0 font-bold select-none">✓</span>
                  <span>100% private sandbox. Zero external database or cloud syncing.</span>
                </div>
                <div className="flex gap-2.5 items-start text-[11.5px] leading-relaxed text-neutral-600">
                  <span className="text-emerald-600 shrink-0 font-bold select-none">✓</span>
                  <span>All decks are saved securely inside this browser's localStorage.</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-neutral-100 bg-neutral-50/40 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 text-[12px] font-bold text-neutral-700 bg-white border border-neutral-200 hover:bg-neutral-50 rounded-none transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`h-9 px-5 text-[12px] font-bold text-white rounded-none transition-colors cursor-pointer ${
              isSwitchingToTeam
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            Confirm Switch
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
