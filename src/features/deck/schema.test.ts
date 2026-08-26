import { describe, it, expect } from 'vitest';
import { SCHEMA_VERSION, migrate, stamp, versionOf, type VersionedSession } from './schema';
import { buildDeckFile, deckFileName, readDeckFile, DECK_FILE_KIND } from './deckFile';
import { createProject, loadProjectSession, saveProjectSession, storageUsage, type StoredSession } from './deckStore';
import type { Deck, SlideInstance } from './types';

const slide = (over: Partial<SlideInstance> = {}): SlideInstance => ({
  instanceId: 's-1',
  templateId: 's1',
  group: 'Introduction',
  title: 'Cover',
  hidden: false,
  content: {},
  ...over,
});

const deck = (name = 'a'): Deck => ({ generated: false, themeId: name, slides: [slide()] });
const session = (name = 'a'): StoredSession => ({ ast: null, deck: deck(name) });

describe('schema versioning', () => {
  it('treats a session written before versioning as version 1', () => {
    expect(versionOf({ ast: null, deck: deck() })).toBe(1);
  });

  it('stamps the current version on write', () => {
    expect(stamp(session()).schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('brings an unversioned session up to date without changing the deck', () => {
    const before: VersionedSession = { ast: null, deck: deck('keep') };
    const { session: after, applied } = migrate(before);
    expect(after.schemaVersion).toBe(SCHEMA_VERSION);
    expect(after.deck).toEqual(before.deck);
    // Nothing to do yet, which is the point of adding the number now.
    expect(applied).toBe(0);
  });

  // Two tabs on two builds is a real situation. Mangling the newer one is worse
  // than rendering it with a feature missing.
  it('hands back a session from a newer build untouched', () => {
    const future: VersionedSession = { ast: null, deck: deck('future'), schemaVersion: SCHEMA_VERSION + 5 };
    const result = migrate(future);
    expect(result.fromFuture).toBe(true);
    expect(result.session).toBe(future);
  });

  it('every read through the store comes back current', () => {
    const meta = createProject('Versioned', session('v'), false, 'u_1');
    // Write an unversioned session straight past the store, the way an older
    // build left it behind.
    localStorage.setItem(`wozku-project-${meta.id}`, JSON.stringify({ ast: null, deck: deck('legacy') }));
    const loaded = loadProjectSession(meta.id) as VersionedSession | null;
    expect(loaded?.schemaVersion).toBe(SCHEMA_VERSION);
    expect(loaded?.deck.themeId).toBe('legacy');
  });

  it('a session saved by the store carries the version', () => {
    const meta = createProject('Stamped', session(), false, 'u_1');
    saveProjectSession(meta.id, session('later'));
    const raw = JSON.parse(localStorage.getItem(`wozku-project-${meta.id}`)!);
    expect(raw.schemaVersion).toBe(SCHEMA_VERSION);
  });
});

describe('deck backup files', () => {
  const now = new Date('2026-08-26T09:30:00Z');

  it('round-trips a deck', () => {
    const file = buildDeckFile('Q3 Review', session('round'), now);
    const back = readDeckFile(JSON.stringify(file));
    expect(back.name).toBe('Q3 Review');
    expect(back.session.deck.themeId).toBe('round');
    expect(back.notes).toEqual([]);
  });

  it('leaves this browser’s working state out of the file', () => {
    const file = buildDeckFile('With history', {
      ast: null,
      deck: deck(),
      draft: deck('draft'),
      dirty: true,
      historyPast: [deck('old')],
      historyFuture: [deck('new')],
    }, now);
    expect(file.session.draft).toBeUndefined();
    expect(file.session.dirty).toBeUndefined();
    expect(file.session.historyPast).toBeUndefined();
    expect(file.kind).toBe(DECK_FILE_KIND);
  });

  it('names the file after the deck', () => {
    expect(deckFileName('UX Journey & Flow')).toBe('ux-journey-flow.wozdeck.json');
    expect(deckFileName('   ')).toBe('deck.wozdeck.json');
  });

  it('says what went wrong rather than throwing a parser error', () => {
    expect(() => readDeckFile('not json at all')).toThrow(/not readable as a deck/);
    expect(() => readDeckFile(JSON.stringify({ hello: 'world' }))).toThrow(/not a Wozku deck file/);
    expect(() => readDeckFile(JSON.stringify({ kind: DECK_FILE_KIND, session: { deck: {} } }))).toThrow(/no slides/);
  });

  it('refuses a file from a newer build instead of dropping its fields', () => {
    const file = buildDeckFile('Future', session(), now);
    file.session.schemaVersion = SCHEMA_VERSION + 1;
    expect(() => readDeckFile(JSON.stringify(file))).toThrow(/newer version/);
  });

  // Video bytes live in IndexedDB, so they cannot travel in a JSON file. The
  // reader has to say so: an empty video slot with no explanation is the exact
  // silent degradation the export path is built to avoid.
  it('warns that uploaded video did not travel', () => {
    const withVideo = session();
    withVideo.deck.slides[0].content.overlay = [
      { id: 'o1', kind: 'video', x: 0, y: 0, w: 100, h: 100, videoAssetId: 'asset-1' },
    ];
    const back = readDeckFile(JSON.stringify(buildDeckFile('Has video', withVideo, now)));
    expect(back.notes.join(' ')).toMatch(/video could not travel/);
  });

  it('does not warn about a video that is a link rather than an upload', () => {
    const linked = session();
    linked.deck.slides[0].content.overlay = [
      { id: 'o1', kind: 'video', x: 0, y: 0, w: 100, h: 100, videoUrl: 'https://youtu.be/abc' },
    ];
    const back = readDeckFile(JSON.stringify(buildDeckFile('Linked video', linked, now)));
    expect(back.notes).toEqual([]);
  });
});

describe('storageUsage', () => {
  it('reports nothing used on an empty store', () => {
    expect(storageUsage().bytes).toBe(0);
    expect(storageUsage().nearLimit).toBe(false);
  });

  it('grows as decks are written, and warns before the ceiling', () => {
    const empty = storageUsage().bytes;
    createProject('Heavy', { ast: null, deck: { ...deck(), slides: [slide({ content: { body: 'x'.repeat(50_000) } })] } }, false, 'u_1');
    const after = storageUsage();
    expect(after.bytes).toBeGreaterThan(empty);
    expect(after.readable).toMatch(/KB|MB/);

    localStorage.setItem('bulk', 'y'.repeat(2_200_000));
    expect(storageUsage().nearLimit).toBe(true);
  });
});
