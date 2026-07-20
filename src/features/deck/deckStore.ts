import type { DocumentNode } from '../business-record/parser/ast';
import type { Deck } from './types';

/**
 * Multi-deck persistence: users keep several named decks side by side, each
 * with its own source + slides + in-progress edits, and switch between them.
 *
 * Layout in localStorage:
 *   wozku-projects-index-v1  → { activeId, projects: ProjectMeta[] }
 *   wozku-project-<id>       → StoredSession   (one per deck)
 */

const INDEX_KEY = 'wozku-projects-index-v1';
const SESSION_PREFIX = 'wozku-project-';
/** Legacy single-session key, migrated into a project on first load. */
const LEGACY_KEY = 'wozku-master-template-session-v1';

export interface ProjectMeta {
  id: string;
  name: string;
  updatedAt: number;
}

export interface StoredSession {
  ast: DocumentNode | null;
  deck: Deck;
  draft?: Deck | null;
  dirty?: boolean;
  /** Undo/redo history, capped to a small window so it survives a reload
   *  without blowing up storage. */
  historyPast?: Deck[];
  historyFuture?: Deck[];
}

interface ProjectIndex {
  activeId: string | null;
  projects: ProjectMeta[];
}

function newId(): string {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function readIndex(): ProjectIndex {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return { activeId: null, projects: [] };
    const parsed = JSON.parse(raw) as ProjectIndex;
    if (!Array.isArray(parsed.projects)) return { activeId: null, projects: [] };
    return parsed;
  } catch {
    return { activeId: null, projects: [] };
  }
}

function writeIndex(index: ProjectIndex): void {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch {
    // Storage may be unavailable (private mode / quota) - non-fatal.
  }
}

function sessionKey(id: string): string {
  return `${SESSION_PREFIX}${id}`;
}

/** Newest-first list of decks for the switcher. */
export function listProjects(): ProjectMeta[] {
  return [...readIndex().projects].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getActiveId(): string | null {
  return readIndex().activeId;
}

export function setActiveId(id: string): void {
  const index = readIndex();
  if (!index.projects.some((p) => p.id === id)) return;
  writeIndex({ ...index, activeId: id });
}

export function loadProjectSession(id: string): StoredSession | null {
  try {
    const raw = localStorage.getItem(sessionKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed.deck || !Array.isArray(parsed.deck.slides)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Persist a deck's session and bump its updatedAt. Returns false (rather
 *  than silently dropping the write) on storage failure, e.g. quota exceeded. */
export function saveProjectSession(id: string, session: StoredSession): boolean {
  try {
    localStorage.setItem(sessionKey(id), JSON.stringify(session));
  } catch {
    return false;
  }
  const index = readIndex();
  const projects = index.projects.map((p) => (p.id === id ? { ...p, updatedAt: Date.now() } : p));
  writeIndex({ ...index, projects });
  return true;
}

/** Add a new deck to the index, save its session, and make it active. */
export function createProject(name: string, session: StoredSession): ProjectMeta {
  const index = readIndex();
  const meta: ProjectMeta = { id: newId(), name: name.trim() || 'Untitled deck', updatedAt: Date.now() };
  writeIndex({ activeId: meta.id, projects: [...index.projects, meta] });
  saveProjectSession(meta.id, session);
  return meta;
}

export function renameProject(id: string, name: string): void {
  const clean = name.trim();
  if (!clean) return;
  const index = readIndex();
  writeIndex({
    ...index,
    projects: index.projects.map((p) => (p.id === id ? { ...p, name: clean, updatedAt: Date.now() } : p)),
  });
}

/** Remove a deck; returns the id that should become active next (or null). */
export function deleteProject(id: string): string | null {
  const index = readIndex();
  const remaining = index.projects.filter((p) => p.id !== id);
  try {
    localStorage.removeItem(sessionKey(id));
  } catch {
    // ignore
  }
  let activeId = index.activeId;
  if (activeId === id) {
    activeId = remaining.length ? [...remaining].sort((a, b) => b.updatedAt - a.updatedAt)[0].id : null;
  }
  writeIndex({ activeId, projects: remaining });
  return activeId;
}

/**
 * Ensure at least one deck exists and return its (active) id + session.
 * Migrates a legacy single-session blob into the first project.
 */
export function ensureInitialized(defaultDeck: () => Deck): { id: string; session: StoredSession } {
  const index = readIndex();

  // Already have projects → return the active one (or the newest).
  if (index.projects.length > 0) {
    const active = index.projects.find((p) => p.id === index.activeId) ?? listProjects()[0];
    if (index.activeId !== active.id) setActiveId(active.id);
    return { id: active.id, session: loadProjectSession(active.id) ?? { ast: null, deck: defaultDeck() } };
  }

  // Migrate a legacy session, if present.
  try {
    const legacyRaw = localStorage.getItem(LEGACY_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw) as StoredSession;
      if (legacy?.deck && Array.isArray(legacy.deck.slides)) {
        const meta = createProject('Untitled deck', legacy);
        localStorage.removeItem(LEGACY_KEY);
        return { id: meta.id, session: legacy };
      }
    }
  } catch {
    // fall through to a fresh deck
  }

  // Fresh start.
  const session: StoredSession = { ast: null, deck: defaultDeck() };
  const meta = createProject('Untitled deck', session);
  return { id: meta.id, session };
}
