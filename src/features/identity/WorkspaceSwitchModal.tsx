import { createPortal } from 'react-dom';
import type { WorkspaceOption } from './profileStore';
import { CloseIcon } from '../ui/icons';

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
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs animate-in fade-in duration-120"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[440px] bg-white border border-neutral-200 shadow-2xl rounded-none overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[16px] select-none">
              {isSwitchingToTeam ? '👥' : '🔒'}
            </span>
            <h3 className="text-[14px] font-bold text-neutral-900">
              {isSwitchingToTeam ? 'Switch to Shared Workspace?' : 'Switch to Personal Workspace?'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-800 p-1 cursor-pointer"
          >
            <CloseIcon size={14} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-3.5">
          <p className="text-[12.5px] leading-relaxed text-neutral-700">
            You are switching your active workspace to{' '}
            <strong className="font-bold text-neutral-900">{targetWorkspace.name}</strong>.
          </p>

          {isSwitchingToTeam ? (
            <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-none flex items-start gap-2.5">
              <span className="text-[14px] select-none shrink-0 mt-0.5">ℹ️</span>
              <div className="text-[11.5px] leading-relaxed text-blue-950">
                <strong className="font-bold block text-blue-900">Team Visibility Notice</strong>
                Decks in team workspaces are accessible to {targetWorkspace.membersCount ?? 'team'} members. Shared brand kits & templates will be active. Your personal local decks remain safe in your private workspace.
              </div>
            </div>
          ) : (
            <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-none flex items-start gap-2.5">
              <span className="text-[14px] select-none shrink-0 mt-0.5">🔒</span>
              <div className="text-[11.5px] leading-relaxed text-emerald-950">
                <strong className="font-bold block text-emerald-900">Personal & Local Storage</strong>
                Decks created here are saved 100% locally in your browser with zero server syncing.
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 py-3.5 border-t border-neutral-200 bg-neutral-50/50 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-3.5 text-[12px] font-bold text-neutral-700 bg-white border border-neutral-200 hover:bg-neutral-100 rounded-none transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`h-8 px-4 text-[12px] font-bold text-white rounded-none transition-colors cursor-pointer ${
              isSwitchingToTeam
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-neutral-900 hover:bg-neutral-800'
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
