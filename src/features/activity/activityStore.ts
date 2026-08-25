import { useEffect, useState, useCallback } from 'react';

export type ActivityType =
  | 'edit'
  | 'slide_add'
  | 'slide_delete'
  | 'template_switch'
  | 'comment'
  | 'invite'
  | 'version_save'
  | 'snapshot_restore';

export interface ActivityEntry {
  id: string;
  projectId: string;
  userId: string;
  userName: string;
  userColor: string;
  type: ActivityType;
  title: string;
  detail?: string;
  timestamp: number;
}

const STORAGE_PREFIX = 'wozku-activity-';

function getStorageKey(projectId: string): string {
  return `${STORAGE_PREFIX}${projectId}`;
}

const DEFAULT_SEEDS: ActivityEntry[] = [
  {
    id: 'act_seed_1',
    projectId: 'default',
    userId: 'u_designer',
    userName: 'Studio Designer',
    userColor: '#10B981',
    type: 'edit',
    title: 'Updated slide typography and layout',
    detail: 'Adjusted headline weight and metric box positions on Slide 2.',
    timestamp: Date.now() - 1000 * 60 * 18, // 18m ago
  },
  {
    id: 'act_seed_2',
    projectId: 'default',
    userId: 'u_admin',
    userName: 'Admin User',
    userColor: '#7C3AED',
    type: 'comment',
    title: 'Added a canvas comment on Slide 2',
    detail: '"Can we double check the brand color contrast here?"',
    timestamp: Date.now() - 1000 * 60 * 45, // 45m ago
  },
  {
    id: 'act_seed_3',
    projectId: 'default',
    userId: 'u_admin',
    userName: 'Admin User',
    userColor: '#7C3AED',
    type: 'invite',
    title: 'Invited Client Reviewer to deck',
    detail: 'Added as Viewer with presentation and commenting access.',
    timestamp: Date.now() - 1000 * 60 * 120, // 2h ago
  },
  {
    id: 'act_seed_4',
    projectId: 'default',
    userId: 'u_designer',
    userName: 'Studio Designer',
    userColor: '#10B981',
    type: 'template_switch',
    title: 'Switched Slide 4 to Split Metrics Template',
    detail: 'Converted layout to 3-column metric comparisons.',
    timestamp: Date.now() - 1000 * 60 * 300, // 5h ago
  },
  {
    id: 'act_seed_5',
    projectId: 'default',
    userId: 'u_admin',
    userName: 'Admin User',
    userColor: '#7C3AED',
    type: 'version_save',
    title: 'Created version snapshot v1.0.4',
    detail: 'Pre-client review snapshot.',
    timestamp: Date.now() - 1000 * 60 * 60 * 24, // 1d ago
  },
];

export function loadDeckActivity(projectId: string): ActivityEntry[] {
  try {
    const raw = localStorage.getItem(getStorageKey(projectId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }

  // Initial seed
  const seeds = DEFAULT_SEEDS.map((s) => ({ ...s, projectId }));
  try {
    localStorage.setItem(getStorageKey(projectId), JSON.stringify(seeds));
  } catch {
    // ignore
  }
  return seeds;
}

export function logDeckActivity(
  projectId: string,
  entry: Omit<ActivityEntry, 'id' | 'projectId' | 'timestamp'>
): ActivityEntry {
  const current = loadDeckActivity(projectId);
  const newEntry: ActivityEntry = {
    ...entry,
    id: `act_${crypto.randomUUID()}`,
    projectId,
    timestamp: Date.now(),
  };
  const updated = [newEntry, ...current].slice(0, 50); // keep 50 latest
  try {
    localStorage.setItem(getStorageKey(projectId), JSON.stringify(updated));
    window.dispatchEvent(
      new CustomEvent('wozku-activity-update', { detail: { projectId } })
    );
  } catch {
    // ignore
  }
  return newEntry;
}

export function useDeckActivity(projectId: string | undefined) {
  const [activities, setActivities] = useState<ActivityEntry[]>(() =>
    projectId ? loadDeckActivity(projectId) : []
  );

  useEffect(() => {
    if (!projectId) {
      setActivities([]);
      return;
    }
    setActivities(loadDeckActivity(projectId));

    const handleUpdate = (e: Event) => {
      const custom = e as CustomEvent<{ projectId?: string }>;
      if (!custom.detail || custom.detail.projectId === projectId) {
        setActivities(loadDeckActivity(projectId));
      }
    };

    window.addEventListener('wozku-activity-update', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('wozku-activity-update', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [projectId]);

  const addActivity = useCallback(
    (entry: Omit<ActivityEntry, 'id' | 'projectId' | 'timestamp'>) => {
      if (!projectId) return;
      logDeckActivity(projectId, entry);
    },
    [projectId]
  );

  return {
    activities,
    addActivity,
  };
}
