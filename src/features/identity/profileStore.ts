/**
 * User Identity and Privacy profile store.
 *
 * Manages local user identity, workspace preferences, and privacy status
 * stored in browser LocalStorage.
 */

export interface WorkspaceOption {
  id: string;
  name: string;
  kind: 'personal' | 'team';
  membersCount?: number;
  badge: string;
}

export const AVAILABLE_WORKSPACES: WorkspaceOption[] = [
  { id: 'personal', name: 'Personal Workspace', kind: 'personal', badge: '🔒 Private (Local)' },
  { id: 'acme_team', name: 'Acme Brand Team', kind: 'team', membersCount: 6, badge: '👥 Shared Team' },
  { id: 'client_vault', name: 'Client Shared Vault', kind: 'team', membersCount: 12, badge: '👥 Shared Team' },
];

export interface UserProfile {
  name: string;
  email: string;
  avatarColor: string;
  workspaceId: string;
  workspaceName: string;
}

const STORAGE_KEY = 'wozku_user_profile';

const DEFAULT_PROFILE: UserProfile = {
  name: 'Studio User',
  email: 'designer@wozku.local',
  avatarColor: '#10B981',
  workspaceId: 'personal',
  workspaceName: 'Personal Workspace',
};

export function loadUserProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function saveUserProfile(profile: Partial<UserProfile>): UserProfile {
  const current = loadUserProfile();
  const next = { ...current, ...profile };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // quota error fallback
  }
  return next;
}

export function getInitials(name: string): string {
  if (!name.trim()) return 'WU';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
