import { useEffect, useState, useCallback } from 'react';

export type NotificationType =
  | 'mention'
  | 'invite_edit'
  | 'invite_view'
  | 'access_granted'
  | 'comment'
  | 'liked';

export interface NotificationItem {
  id: string;
  userId: string;
  authorName: string;
  authorColor: string;
  type: NotificationType;
  title: string;
  description?: string;
  deckName?: string;
  projectId?: string;
  createdAt: number;
  read: boolean;
  inviteStatus?: 'pending' | 'accepted' | 'declined';
}

const STORAGE_PREFIX = 'wozku-notifications-';

const SEED_NOTIFICATIONS: Record<string, NotificationItem[]> = {
  u_admin: [
    {
      id: 'notif_seed_1',
      userId: 'u_admin',
      authorName: 'Studio Designer',
      authorColor: '#10B981',
      type: 'mention',
      title: 'Commented on Q3 Performance Review',
      description: 'These draggable slides look really clean. Can you review the typography and layout on slide 2?',
      deckName: 'Q3 Performance Review',
      createdAt: Date.now() - 1000 * 60 * 15, // 15m ago
      read: false,
    },
    {
      id: 'notif_seed_2',
      userId: 'u_admin',
      authorName: 'Client Reviewer',
      authorColor: '#F59E0B',
      type: 'invite_edit',
      title: 'Invited you to edit Atlas Freight Brand Strategy',
      description: 'You have been invited with full editor permissions to collaborate on this deck.',
      deckName: 'Atlas Freight Brand Strategy',
      createdAt: Date.now() - 1000 * 60 * 65, // 1h ago
      read: false,
      inviteStatus: 'pending',
    },
    {
      id: 'notif_seed_3',
      userId: 'u_admin',
      authorName: 'Studio Designer',
      authorColor: '#10B981',
      type: 'invite_view',
      title: 'Invited you to view Minimalist Architecture Scene',
      description: 'Shared presentation for client signoff and review.',
      deckName: 'Minimalist Architecture Scene',
      createdAt: Date.now() - 1000 * 60 * 140, // 2h ago
      read: false,
      inviteStatus: 'pending',
    },
    {
      id: 'notif_seed_4',
      userId: 'u_admin',
      authorName: 'Studio Designer',
      authorColor: '#10B981',
      type: 'access_granted',
      title: 'Granted editing access to Meridian Retail',
      description: 'You now have administrative access to the repository template.',
      deckName: 'Meridian Retail',
      createdAt: Date.now() - 1000 * 60 * 60 * 5, // 5h ago
      read: true,
    },
    {
      id: 'notif_seed_5',
      userId: 'u_admin',
      authorName: 'Client Reviewer',
      authorColor: '#F59E0B',
      type: 'liked',
      title: 'Liked Classic Pitch Deck in Studio',
      deckName: 'Classic Pitch Deck',
      createdAt: Date.now() - 1000 * 60 * 60 * 24, // 1d ago
      read: true,
    },
  ],
  u_designer: [
    {
      id: 'notif_seed_d1',
      userId: 'u_designer',
      authorName: 'Admin User',
      authorColor: '#7C3AED',
      type: 'mention',
      title: 'Commented on Q3 Performance Review',
      description: '@Studio Designer layout approved! Let\'s finalize the export and present.',
      deckName: 'Q3 Performance Review',
      createdAt: Date.now() - 1000 * 60 * 8,
      read: false,
    },
    {
      id: 'notif_seed_d2',
      userId: 'u_designer',
      authorName: 'Client Reviewer',
      authorColor: '#F59E0B',
      type: 'invite_edit',
      title: 'Invited you to edit Kestrel Bio Presentation',
      description: 'Invited you as an Editor to build the brand identity slide structure.',
      deckName: 'Kestrel Bio Presentation',
      createdAt: Date.now() - 1000 * 60 * 45,
      read: false,
      inviteStatus: 'pending',
    },
  ],
  u_reviewer: [
    {
      id: 'notif_seed_r1',
      userId: 'u_reviewer',
      authorName: 'Admin User',
      authorColor: '#7C3AED',
      type: 'invite_view',
      title: 'Invited you to view Q3 Performance Review',
      description: 'Please review the latest slides for the quarterly stakeholder meeting.',
      deckName: 'Q3 Performance Review',
      createdAt: Date.now() - 1000 * 60 * 20,
      read: false,
      inviteStatus: 'pending',
    },
  ],
};

function getStorageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

export function loadUserNotifications(userId: string): NotificationItem[] {
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }

  // Fallback to seed notifications
  const seeds = SEED_NOTIFICATIONS[userId] || [];
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(seeds));
  } catch {
    // ignore
  }
  return seeds;
}

export function saveUserNotifications(userId: string, notifs: NotificationItem[]): void {
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(notifs));
    window.dispatchEvent(new CustomEvent('wozku-notifs-update', { detail: { userId } }));
  } catch {
    // ignore
  }
}

export function addNotification(
  userId: string,
  notif: Omit<NotificationItem, 'id' | 'createdAt' | 'read' | 'userId'>
): NotificationItem {
  const current = loadUserNotifications(userId);
  const newItem: NotificationItem = {
    ...notif,
    id: `notif_${crypto.randomUUID()}`,
    userId,
    createdAt: Date.now(),
    read: false,
  };
  const updated = [newItem, ...current];
  saveUserNotifications(userId, updated);
  return newItem;
}

export function markAllUserNotificationsRead(userId: string): void {
  const current = loadUserNotifications(userId);
  const updated = current.map((n) => ({ ...n, read: true }));
  saveUserNotifications(userId, updated);
}

export function markNotificationRead(userId: string, notifId: string): void {
  const current = loadUserNotifications(userId);
  const updated = current.map((n) => (n.id === notifId ? { ...n, read: true } : n));
  saveUserNotifications(userId, updated);
}

export function updateNotificationInviteStatus(
  userId: string,
  notifId: string,
  inviteStatus: 'accepted' | 'declined'
): void {
  const current = loadUserNotifications(userId);
  const updated = current.map((n) =>
    n.id === notifId ? { ...n, inviteStatus, read: true } : n
  );
  saveUserNotifications(userId, updated);
}

export function useNotifications(userId: string | undefined) {
  const [notifications, setNotifications] = useState<NotificationItem[]>(() =>
    userId ? loadUserNotifications(userId) : []
  );

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      return;
    }
    setNotifications(loadUserNotifications(userId));

    const handleUpdate = (e: Event) => {
      const custom = e as CustomEvent<{ userId?: string }>;
      if (!custom.detail || custom.detail.userId === userId) {
        setNotifications(loadUserNotifications(userId));
      }
    };

    window.addEventListener('wozku-notifs-update', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('wozku-notifs-update', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [userId]);

  const markAllRead = useCallback(() => {
    if (!userId) return;
    markAllUserNotificationsRead(userId);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, [userId]);

  const markSingleRead = useCallback(
    (notifId: string) => {
      if (!userId) return;
      markNotificationRead(userId, notifId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, read: true } : n))
      );
    },
    [userId]
  );

  const respondToInvite = useCallback(
    (notifId: string, status: 'accepted' | 'declined') => {
      if (!userId) return;
      updateNotificationInviteStatus(userId, notifId, status);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notifId ? { ...n, inviteStatus: status, read: true } : n
        )
      );
    },
    [userId]
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    notifications,
    unreadCount,
    markAllRead,
    markSingleRead,
    respondToInvite,
  };
}
