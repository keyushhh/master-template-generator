import { describe, it, expect } from 'vitest';
import { fillStorage } from '../../test/localStorage';
import {
  canEdit,
  createFolder,
  createProject,
  deleteProject,
  duplicateProject,
  listFolders,
  listProjects,
  loadProjectSession,
  moveProjectsToFolder,
  promoteToRepository,
  renameProject,
  roleFor,
  saveProjectSession,
  shareProject,
  unshareProject,
  visibleProjects,
  type StoredSession,
} from './deckStore';
import type { Deck } from './types';

const deck = (name = 'a'): Deck => ({
  generated: false,
  themeId: name,
  slides: [{ instanceId: 's-1', templateId: 's1', group: 'Introduction', title: 'Cover', hidden: false, content: {} }],
});

const session = (name = 'a'): StoredSession => ({ ast: null, deck: deck(name) });

describe('projects', () => {
  it('creates a deck, makes it active, and reads it back', () => {
    const meta = createProject('Q3 Review', session('q3'), false, 'u_1');
    expect(listProjects().map((p) => p.name)).toEqual(['Q3 Review']);
    expect(loadProjectSession(meta.id)?.deck.themeId).toBe('q3');
  });

  it('falls back to a name for a deck saved without one', () => {
    const meta = createProject('   ', session(), false, 'u_1');
    expect(meta.name).toBe('Untitled deck');
  });

  it('reports a failed write instead of dropping it silently', () => {
    const meta = createProject('Big deck', session(), false, 'u_1');
    fillStorage();
    expect(saveProjectSession(meta.id, session('changed'))).toBe(false);
  });

  it('renames without touching the deck itself', () => {
    const meta = createProject('Old name', session('keep'), false, 'u_1');
    renameProject(meta.id, 'New name');
    expect(listProjects()[0].name).toBe('New name');
    expect(loadProjectSession(meta.id)?.deck.themeId).toBe('keep');
  });

  it('duplicates a deck as an independent copy', () => {
    const meta = createProject('Original', session('one'), false, 'u_1');
    const copy = duplicateProject(meta.id);
    expect(copy).not.toBeNull();
    expect(copy!.id).not.toBe(meta.id);

    saveProjectSession(copy!.id, session('two'));
    expect(loadProjectSession(meta.id)?.deck.themeId).toBe('one');
    expect(loadProjectSession(copy!.id)?.deck.themeId).toBe('two');
  });

  it('deleting removes the deck and its stored session', () => {
    const a = createProject('A', session(), false, 'u_1');
    const b = createProject('B', session(), false, 'u_1');
    deleteProject(a.id);
    expect(listProjects().map((p) => p.id)).toEqual([b.id]);
    expect(loadProjectSession(a.id)).toBeNull();
  });

  it('reads nothing back for an id that was never saved', () => {
    expect(loadProjectSession('p_nope')).toBeNull();
  });

  it('promotes a sandbox deck into the repository', () => {
    const meta = createProject('Scratch', session(), true, 'u_1');
    expect(listProjects()[0].isSandbox).toBe(true);
    promoteToRepository(meta.id);
    expect(listProjects()[0].isSandbox).toBeFalsy();
  });
});

describe('sharing', () => {
  it('gives the owner edit rights and a stranger none', () => {
    const meta = createProject('Mine', session(), false, 'u_owner');
    const project = listProjects().find((p) => p.id === meta.id)!;
    expect(roleFor(project, 'u_owner')).toBe('owner');
    expect(roleFor(project, 'u_other')).toBeNull();
    expect(canEdit(project, 'u_owner')).toBe(true);
    expect(canEdit(project, 'u_other')).toBe(false);
  });

  it('a viewer can see the deck but not edit it', () => {
    const meta = createProject('Shared', session(), false, 'u_owner');
    shareProject(meta.id, 'u_guest', 'viewer');
    const project = listProjects().find((p) => p.id === meta.id)!;
    expect(canEdit(project, 'u_guest')).toBe(false);
    expect(visibleProjects('u_guest').map((p) => p.id)).toEqual([meta.id]);
  });

  it('an editor can edit, and revoking takes it back', () => {
    const meta = createProject('Shared', session(), false, 'u_owner');
    shareProject(meta.id, 'u_guest', 'editor');
    expect(canEdit(listProjects()[0], 'u_guest')).toBe(true);

    unshareProject(meta.id, 'u_guest');
    expect(canEdit(listProjects()[0], 'u_guest')).toBe(false);
    expect(visibleProjects('u_guest')).toEqual([]);
  });

  it('changing a role replaces it rather than adding a second one', () => {
    const meta = createProject('Shared', session(), false, 'u_owner');
    shareProject(meta.id, 'u_guest', 'viewer');
    shareProject(meta.id, 'u_guest', 'editor');
    const project = listProjects()[0];
    expect(project.collaborators).toHaveLength(1);
    expect(roleFor(project, 'u_guest')).toBe('editor');
  });
});

describe('folders', () => {
  it('files several decks at once and can empty the folder again', () => {
    const folder = createFolder('Client work', 'emerald');
    const a = createProject('A', session(), false, 'u_1');
    const b = createProject('B', session(), false, 'u_1');

    moveProjectsToFolder([a.id, b.id], folder.id);
    expect(listProjects().every((p) => p.folderId === folder.id)).toBe(true);

    moveProjectsToFolder([a.id], null);
    const byId = Object.fromEntries(listProjects().map((p) => [p.id, p.folderId]));
    // Unfiled is stored as null rather than a missing key, so the write is
    // explicit and a JSON round trip cannot turn it back into a folder id.
    expect(byId[a.id]).toBeNull();
    expect(byId[b.id]).toBe(folder.id);
  });

  it('keeps the colour it was created with', () => {
    createFolder('Pitches', 'rose');
    expect(listFolders()[0].color).toBe('rose');
  });
});
