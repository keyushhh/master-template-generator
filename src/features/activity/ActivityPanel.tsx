import { useEffect, useRef } from 'react';
import { CloseIcon, HistoryIcon, CommentIcon, UserPlusIcon, CreateIcon, CheckIcon } from '../ui/icons';
import { initialsOf } from '../auth/demoUsers';
import { useDeckActivity, type ActivityEntry } from './activityStore';

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
}

function timeAgo(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  return `${diffDay}d ago`;
}

function getActivityIcon(type: ActivityEntry['type']) {
  switch (type) {
    case 'comment':
      return <CommentIcon size={11} />;
    case 'invite':
      return <UserPlusIcon size={11} />;
    case 'version_save':
    case 'snapshot_restore':
      return <HistoryIcon size={11} />;
    case 'edit':
    case 'slide_add':
    case 'slide_delete':
    case 'template_switch':
    default:
      return <CreateIcon size={11} />;
  }
}

export function ActivityPanel({ open, onClose, projectId }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { activities } = useDeckActivity(projectId);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        top: 80,
        right: 16,
        bottom: 24,
        width: 340,
        backgroundColor: '#FFFFFF',
        border: '1px solid var(--neutral-200, #E5E5E5)',
        boxShadow: '0 16px 40px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06)',
        borderRadius: 0,
        zIndex: 140,
        display: 'flex',
        flexDirection: 'column',
      }}
      className="animate-in slide-in-from-right-4 fade-in duration-150"
    >
      {/* Panel Header */}
      <div className="p-3.5 border-b border-neutral-200 bg-neutral-50/90 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HistoryIcon size={14} />
          <h3 className="text-[12.5px] font-bold text-neutral-900 uppercase tracking-wider">
            Deck Activity
          </h3>
          <span className="px-1.5 h-4 bg-neutral-200 text-neutral-700 text-[9.5px] font-mono font-bold flex items-center justify-center rounded-none">
            {activities.length}
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close activity stream"
          className="text-neutral-400 hover:text-neutral-900 p-1 cursor-pointer transition-colors"
        >
          <CloseIcon size={14} />
        </button>
      </div>

      {/* Activity Timeline List */}
      <div className="flex-1 overflow-y-auto divide-y divide-neutral-100 p-2">
        {activities.length === 0 ? (
          <div className="py-16 text-center text-[12px] font-mono text-neutral-400">
            No activity recorded yet
          </div>
        ) : (
          activities.map((act) => (
            <div
              key={act.id}
              className="p-3 flex items-start gap-3 hover:bg-neutral-50/80 transition-colors text-left"
            >
              {/* User Avatar */}
              <div className="relative shrink-0 mt-0.5">
                <span
                  className="w-7 h-7 rounded-none flex items-center justify-center text-[9.5px] font-mono font-bold text-white select-none shadow-xs"
                  style={{ backgroundColor: act.userColor }}
                >
                  {initialsOf(act.userName)}
                </span>
                <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-neutral-900 text-white rounded-none flex items-center justify-center border border-white">
                  {getActivityIcon(act.type)}
                </span>
              </div>

              {/* Event Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-1">
                  <span className="text-[12px] font-bold text-neutral-900 truncate">
                    {act.userName}
                  </span>
                  <span className="text-[10.5px] font-mono text-neutral-400 shrink-0">
                    {timeAgo(act.timestamp)}
                  </span>
                </div>

                <p className="text-[12px] font-medium text-neutral-800 leading-snug mt-0.5">
                  {act.title}
                </p>

                {act.detail && (
                  <p className="text-[11px] text-neutral-500 line-clamp-2 leading-relaxed mt-1">
                    {act.detail}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer Info */}
      <div className="p-2.5 bg-neutral-50 border-t border-neutral-200 text-center">
        <span className="text-[10.5px] font-mono text-neutral-400">
          Live Collaboration Stream • Syncs across all peers
        </span>
      </div>
    </div>
  );
}
