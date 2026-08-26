import type { DocumentNode } from '../business-record/parser/ast';
import { migrate, stamp } from './schema';
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

export type FolderColor = 'orange' | 'purple' | 'blue' | 'emerald' | 'rose' | 'slate' | 'indigo' | 'amber';

export interface FolderMeta {
  id: string;
  name: string;
  color: FolderColor;
  createdAt: number;
  updatedAt: number;
}

export type CollaboratorRole = 'editor' | 'viewer';

export interface Collaborator {
  userId: string;
  role: CollaboratorRole;
}

export interface ProjectMeta {
  id: string;
  name: string;
  updatedAt: number;
  folderId?: string | null;
  isSandbox?: boolean;
  /** Who the deck belongs to. Absent on every deck made before sharing existed;
   *  `claimOwnerless` adopts those for whoever is signed in. */
  ownerId?: string;
  /** Everyone the owner has invited, and what they may do. */
  collaborators?: Collaborator[];
}

export interface StoredSession {
  /** Stamped on write by `saveProjectSession`. Absent on sessions written
   *  before versioning existed, which are version 1 by definition. */
  schemaVersion?: number;
  ast: DocumentNode | null;
  deck: Deck;
  draft?: Deck | null;
  dirty?: boolean;
  /** Undo/redo history, capped to a small window so it survives a reload
   *  without blowing up storage. */
  historyPast?: Deck[];
  historyFuture?: Deck[];
  /** What this deck looked like right after import/generation - what Reset
   *  restores. Absent (legacy sessions, or a deck that started from the blank
   *  template) falls back to the generic placeholder deck. */
  baselineDeck?: Deck;
}

interface ProjectIndex {
  activeId: string | null;
  projects: ProjectMeta[];
}

function newId(): string {
  return `p_${crypto.randomUUID()}`;
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

/**
 * Calls back when another tab changes the project index: a deck shared, a role
 * changed, a deck renamed or deleted.
 *
 * The storage event fires only in the tabs that did not make the change, which
 * is exactly the set of tabs that need telling. It also reaches tabs sitting on
 * a different deck, or on the library, which a per-deck channel cannot.
 */
export function onProjectsChanged(fn: () => void): () => void {
  const handler = (e: StorageEvent) => {
    // A null key means the whole store was cleared.
    if (e.key === null || e.key === INDEX_KEY) fn();
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}

/** Newest-first list of decks for the switcher. */
export function listProjects(): ProjectMeta[] {
  return [...readIndex().projects].sort((a, b) => b.updatedAt - a.updatedAt);
}

/** What this person may do with a deck. A deck nobody owns is treated as
 *  theirs, which is what makes decks that predate sharing still openable. */
export function roleFor(project: ProjectMeta, userId: string): 'owner' | CollaboratorRole | null {
  if (!project.ownerId || project.ownerId === userId) return 'owner';
  return project.collaborators?.find((c) => c.userId === userId)?.role ?? null;
}

export function canEdit(project: ProjectMeta, userId: string): boolean {
  const role = roleFor(project, userId);
  return role === 'owner' || role === 'editor';
}

/** Decks this person owns or has been invited to, newest first. */
export function visibleProjects(userId: string): ProjectMeta[] {
  return listProjects().filter((p) => roleFor(p, userId) !== null);
}

/** Adopt every ownerless deck for this person, once, on first sign-in. Decks
 *  made before sharing existed have no owner, and an unowned deck would show up
 *  for everyone. */
export function claimOwnerless(userId: string): void {
  const index = readIndex();
  if (!index.projects.some((p) => !p.ownerId)) return;
  writeIndex({
    ...index,
    projects: index.projects.map((p) => (p.ownerId ? p : { ...p, ownerId: userId })),
  });
}

export function shareProject(id: string, userId: string, role: CollaboratorRole): void {
  const index = readIndex();
  writeIndex({
    ...index,
    projects: index.projects.map((p) => {
      if (p.id !== id || p.ownerId === userId) return p;
      const others = (p.collaborators ?? []).filter((c) => c.userId !== userId);
      return { ...p, collaborators: [...others, { userId, role }] };
    }),
  });
}

export function unshareProject(id: string, userId: string): void {
  const index = readIndex();
  writeIndex({
    ...index,
    projects: index.projects.map((p) => (p.id === id
      ? { ...p, collaborators: (p.collaborators ?? []).filter((c) => c.userId !== userId) }
      : p)),
  });
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
    // Every read goes through the migration, so the rest of the app only ever
    // sees a current session and no caller has to know what version it was.
    return migrate(parsed).session;
  } catch {
    return null;
  }
}

/** Persist a deck's session and bump its updatedAt. Returns false (rather
 *  than silently dropping the write) on storage failure, e.g. quota exceeded. */
export function saveProjectSession(id: string, session: StoredSession): boolean {
  try {
    localStorage.setItem(sessionKey(id), JSON.stringify(stamp(session)));
  } catch {
    return false;
  }
  const index = readIndex();
  const projects = index.projects.map((p) => (p.id === id ? { ...p, updatedAt: Date.now() } : p));
  writeIndex({ ...index, projects });
  return true;
}

/**
 * How much of the browser's ~5MB localStorage budget this app is using.
 *
 * Reported before a write fails rather than after: the storage ceiling used to
 * announce itself only as a failed save, which is the worst moment to learn
 * about it. Counts UTF-16 code units, which is what browsers charge for.
 */
export interface StorageUsage {
  bytes: number;
  readable: string;
  /** 0 to 100, against the 5MB budget browsers give a single origin. */
  percent: number;
  /** Past this, a large image or a long deck is likely to fail to save. */
  nearLimit: boolean;
}

const STORAGE_BUDGET_BYTES = 5 * 1024 * 1024;

export function storageUsage(): StorageUsage {
  let bytes = 0;
  try {
    // length/key rather than Object.keys: the latter walks the Storage object's
    // own properties, which is a browser quirk rather than the API.
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key === null) continue;
      bytes += ((localStorage.getItem(key)?.length ?? 0) + key.length) * 2;
    }
  } catch {
    // Storage unavailable (private mode); nothing is stored, so nothing is used.
  }
  const mb = bytes / (1024 * 1024);
  const percent = Math.min(100, (bytes / STORAGE_BUDGET_BYTES) * 100);
  return {
    bytes,
    readable: mb < 0.1 ? `${Math.round(bytes / 1024)} KB` : `${mb.toFixed(1)} MB`,
    percent,
    nearLimit: percent >= 80,
  };
}

/** Add a new deck to the index, save its session, and make it active. */
export function createProject(
  name: string,
  session: StoredSession,
  isSandbox?: boolean,
  ownerId?: string
): ProjectMeta {
  const index = readIndex();
  const meta: ProjectMeta = { id: newId(), name: name.trim() || 'Untitled deck', updatedAt: Date.now(), isSandbox, ownerId };
  writeIndex({ activeId: meta.id, projects: [...index.projects, meta] });
  saveProjectSession(meta.id, session);
  return meta;
}

/**
 * Copy a deck, slides and all, as a new project.
 *
 * The copy deliberately drops the source's undo history and its unsaved draft,
 * keeping only the committed deck: inheriting another deck's history would let
 * Undo in the copy walk back through edits that were never made to it.
 */
export function duplicateProject(id: string, name?: string): ProjectMeta | null {
  const session = loadProjectSession(id);
  if (!session) return null;
  const source = readIndex().projects.find((p) => p.id === id);
  return createProject(name ?? `${source?.name ?? 'Untitled deck'} copy`, {
    ast: session.ast,
    deck: session.deck,
    baselineDeck: session.baselineDeck ?? session.deck,
  });
}

export function promoteToRepository(id: string): void {
  const index = readIndex();
  writeIndex({
    ...index,
    projects: index.projects.map((p) => (p.id === id ? { ...p, isSandbox: false, updatedAt: Date.now() } : p)),
  });
}

/**
 * Force a deck's "last edited" stamp.
 *
 * Normally `updatedAt` is owned by `saveProjectSession` and should stay that way.
 * This exists for callers that are reconstructing history rather than making it:
 * the dev library seeder, and any future import that needs to preserve a deck's
 * original date instead of stamping everything with the moment of the import.
 */
export function setProjectUpdatedAt(id: string, ts: number): void {
  const index = readIndex();
  writeIndex({
    ...index,
    projects: index.projects.map((p) => (p.id === id ? { ...p, updatedAt: ts } : p)),
  });
}

/** Meta plus enough of the deck to draw a gallery card. */
export interface ProjectSummary extends ProjectMeta {
  /** The first slide that would actually be shown, for the cover thumbnail.
   *  Null for a deck whose slides failed to load. */
  deck: StoredSession['deck'] | null;
}

/**
 * Every deck with its content, newest first, for the home gallery.
 *
 * Reads each project's full session rather than just the index, because a
 * gallery of names is not a gallery - you recognise last quarter's deck by its
 * cover, not by remembering what you called it.
 */
export function listProjectSummaries(): ProjectSummary[] {
  return listProjects().map((meta) => ({
    ...meta,
    deck: loadProjectSession(meta.id)?.deck ?? null,
  }));
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

const FOLDERS_KEY = 'wozku-folders-v1';

export function listFolders(): FolderMeta[] {
  try {
    const raw = localStorage.getItem(FOLDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FolderMeta[];
    return Array.isArray(parsed) ? parsed.sort((a, b) => b.updatedAt - a.updatedAt) : [];
  } catch {
    return [];
  }
}

function writeFolders(folders: FolderMeta[]): void {
  try {
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
  } catch {}
}

export function createFolder(name: string, color: FolderColor = 'blue'): FolderMeta {
  const clean = name.trim() || 'New Folder';
  const folder: FolderMeta = {
    id: `f_${crypto.randomUUID()}`,
    name: clean,
    color,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const folders = listFolders();
  writeFolders([folder, ...folders]);
  return folder;
}

export function renameFolder(id: string, name: string): void {
  const clean = name.trim();
  if (!clean) return;
  const folders = listFolders();
  writeFolders(folders.map((f) => (f.id === id ? { ...f, name: clean, updatedAt: Date.now() } : f)));
}

export function updateFolderColor(id: string, color: FolderColor): void {
  const folders = listFolders();
  writeFolders(folders.map((f) => (f.id === id ? { ...f, color, updatedAt: Date.now() } : f)));
}

export function deleteFolder(id: string): void {
  const folders = listFolders();
  writeFolders(folders.filter((f) => f.id !== id));
  // Move decks inside this folder to root (null)
  const index = readIndex();
  const updatedProjects = index.projects.map((p) => (p.folderId === id ? { ...p, folderId: null } : p));
  writeIndex({ ...index, projects: updatedProjects });
}

export function moveProjectToFolder(projectId: string, folderId: string | null): void {
  const index = readIndex();
  writeIndex({
    ...index,
    projects: index.projects.map((p) => (p.id === projectId ? { ...p, folderId: folderId ?? null, updatedAt: Date.now() } : p)),
  });
}

export function moveProjectsToFolder(projectIds: string[], folderId: string | null): void {
  const set = new Set(projectIds);
  const index = readIndex();
  writeIndex({
    ...index,
    projects: index.projects.map((p) =>
      set.has(p.id) ? { ...p, folderId: folderId ?? null, updatedAt: Date.now() } : p
    ),
  });
}
