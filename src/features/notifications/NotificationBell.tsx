import { useEffect, useRef, useState } from 'react';
import {
  BellIcon,
  CommentIcon,
  HeartIcon,
  UserPlusIcon,
  CheckCircleIcon,
  LightningIcon,
} from '../ui/icons';
import { useAuth } from '../auth/authStore';
import { initialsOf } from '../auth/demoUsers';
import { useNotifications, type NotificationItem } from './notificationStore';

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

function getBadgeProps(type: NotificationItem['type']) {
  switch (type) {
    case 'mention':
    case 'comment':
      return {
        bg: '#8B5CF6',
        icon: <CommentIcon size={8} />,
      };
    case 'invite_edit':
    case 'invite_view':
      return {
        bg: '#10B981',
        icon: <UserPlusIcon size={8} />,
      };
    case 'liked':
      return {
        bg: '#F43F5E',
        icon: <HeartIcon size={8} />,
      };
    case 'access_granted':
    default:
      return {
        bg: '#0D99FF',
        icon: <LightningIcon size={8} />,
      };
  }
}

function getActionText(notif: NotificationItem) {
  const deck = notif.deckName ? (
    <span className="font-bold text-neutral-900">{notif.deckName}</span>
  ) : null;

  switch (notif.type) {
    case 'mention':
    case 'comment':
      return <>Commented on {deck}</>;
    case 'invite_edit':
      return <>Invited you to edit {deck}</>;
    case 'invite_view':
      return <>Invited you to view {deck}</>;
    case 'access_granted':
      return <>Granted editing access to {deck}</>;
    case 'liked':
      return <>Liked {deck}</>;
    default:
      return notif.title;
  }
}

export function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, markAllRead, markSingleRead, respondToInvite } =
    useNotifications(user?.id);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  if (!user) return null;

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      {/* ── Standalone Sharp Notification Bell Button ── */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={`Notifications (${unreadCount} unread)`}
        aria-label="Notifications"
        className="relative flex items-center justify-center w-[34px] h-[34px] border border-neutral-200 bg-white hover:bg-neutral-50 rounded-none transition-colors cursor-pointer outline-none focus:border-neutral-900"
      >
        <BellIcon size={15} />

        {unreadCount > 0 && (
          <span
            className="absolute -top-1.5 -right-1.5 min-w-[17px] h-[17px] px-1 bg-rose-600 text-white text-[9px] font-mono font-bold flex items-center justify-center rounded-none shadow-xs border border-white"
          >
            {unreadCount}
          </span>
        )}
      </button>

      {/* ── Dedicated Notifications Popover ── */}
      {open && (
        <div
          style={{
            width: 380,
            borderRadius: 0,
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06)',
          }}
          className="absolute right-0 top-full mt-2 bg-white border border-neutral-200 rounded-none overflow-hidden z-[250] animate-in fade-in duration-100"
        >
          {/* Header Row: "Notifications" + "Mark all as read" */}
          <div className="px-4 py-3 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/80">
            <div className="flex items-center gap-2">
              <h3 className="text-[13px] font-bold text-neutral-900 tracking-wider uppercase">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <span className="px-1.5 h-4 bg-rose-600 text-white text-[9px] font-mono font-bold flex items-center justify-center rounded-none">
                  {unreadCount}
                </span>
              )}
            </div>

            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={markAllRead}
                title="Mark all as read"
                className="text-[11.5px] font-bold text-neutral-600 hover:text-neutral-950 transition-colors cursor-pointer"
              >
                Mark all as read
              </button>
            ) : (
              <span className="text-[11px] font-mono text-neutral-400">
                All caught up
              </span>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-neutral-100">
            {notifications.length === 0 ? (
              <div className="py-12 text-center text-[12px] font-mono text-neutral-400">
                No notifications
              </div>
            ) : (
              notifications.map((notif) => {
                const badge = getBadgeProps(notif.type);
                const isInvite = notif.type === 'invite_edit' || notif.type === 'invite_view';

                return (
                  <div
                    key={notif.id}
                    onClick={() => markSingleRead(notif.id)}
                    className={`p-3.5 flex items-start gap-3 transition-colors text-left cursor-pointer ${
                      notif.read ? 'bg-white hover:bg-neutral-50' : 'bg-neutral-50/70 hover:bg-neutral-100/60'
                    }`}
                  >
                    {/* Sharp Square User Avatar with Mini Badge */}
                    <div className="relative shrink-0 mt-0.5">
                      <span
                        className="w-8 h-8 rounded-none flex items-center justify-center text-[10.5px] font-mono font-bold text-white select-none shadow-xs"
                        style={{ backgroundColor: notif.authorColor }}
                      >
                        {initialsOf(notif.authorName)}
                      </span>
                      <span
                        className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-none flex items-center justify-center text-white border border-white"
                        style={{ backgroundColor: badge.bg }}
                      >
                        {badge.icon}
                      </span>
                    </div>

                    {/* Notification Body */}
                    <div className="flex-1 min-w-0">
                      {/* Author Name + Timestamp */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-baseline gap-1.5 truncate">
                          <span className="text-[12.5px] font-bold text-neutral-900 truncate">
                            {notif.authorName}
                          </span>
                          <span className="text-[11px] font-mono text-neutral-400 shrink-0">
                            {timeAgo(notif.createdAt)}
                          </span>
                        </div>

                        {/* Unread Square Indicator */}
                        {!notif.read && (
                          <span className="w-1.5 h-1.5 rounded-none bg-rose-600 shrink-0" />
                        )}
                      </div>

                      {/* Action Line */}
                      <div className="text-[12px] text-neutral-800 leading-snug mt-0.5">
                        {getActionText(notif)}
                      </div>

                      {/* Description / Comment Quote */}
                      {notif.description && (
                        <p className="text-[11.5px] text-neutral-500 line-clamp-2 leading-relaxed mt-1">
                          {notif.description}
                        </p>
                      )}

                      {/* Interactive Accept / Decline Buttons for Invitations */}
                      {isInvite && notif.inviteStatus === 'pending' && (
                        <div
                          className="flex items-center gap-2 mt-2.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => respondToInvite(notif.id, 'declined')}
                            className="px-3.5 py-1 bg-white border border-neutral-300 hover:bg-neutral-100 text-neutral-800 font-bold text-[11.5px] rounded-none transition-colors cursor-pointer"
                          >
                            Decline
                          </button>
                          <button
                            type="button"
                            onClick={() => respondToInvite(notif.id, 'accepted')}
                            className="px-3.5 py-1 bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-[11.5px] rounded-none transition-colors cursor-pointer"
                          >
                            Accept
                          </button>
                        </div>
                      )}

                      {/* Accepted / Declined status feedback */}
                      {isInvite && notif.inviteStatus === 'accepted' && (
                        <div className="mt-2 text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                          <CheckCircleIcon size={12} />
                          <span>Accepted — access enabled</span>
                        </div>
                      )}

                      {isInvite && notif.inviteStatus === 'declined' && (
                        <div className="mt-2 text-[11px] font-medium text-neutral-400">
                          Invitation declined
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
