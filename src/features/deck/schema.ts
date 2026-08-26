import type { StoredSession } from './deckStore';

/**
 * The version stamped on everything this app writes to storage, and the
 * migration path off older versions.
 *
 * Until now every stored session was unversioned. That worked because the model
 * only ever grew optional fields, where absent means the old behaviour, and
 * that rule is worth keeping. But it only covers additions: the first change
 * that cannot be expressed as an optional field (a field that changes meaning,
 * a list that becomes a map, a unit that changes) has nowhere to hang a
 * migration, and by then every deck in existence is ambiguous.
 *
 * So the number goes in now, while the migration is empty and every session in
 * the world is version 1. A reader that finds no version treats the session as
 * version 1, which is exactly what it is.
 *
 * To add a migration: raise SCHEMA_VERSION, add an entry to MIGRATIONS keyed by
 * the version it upgrades *from*, and leave the older entries alone. They run
 * in order, so a version 1 session can reach version 4 in three steps.
 */

export const SCHEMA_VERSION = 1;

/** A stored session as it sits on disk: the version may be absent (pre-versioning). */
export type VersionedSession = StoredSession & { schemaVersion?: number };

type Migration = (session: VersionedSession) => VersionedSession;

/** Keyed by the version each one upgrades from. */
const MIGRATIONS: Record<number, Migration> = {
  // 1 -> 2 goes here when there is a 2.
};

export function stamp(session: StoredSession): VersionedSession {
  return { ...session, schemaVersion: SCHEMA_VERSION };
}

/** The version a stored session declares. Absent means the original, 1. */
export function versionOf(session: VersionedSession): number {
  const v = session.schemaVersion;
  return typeof v === 'number' && v >= 1 ? v : 1;
}

export interface MigrationResult {
  session: VersionedSession;
  /** How many steps ran. Zero means the session was already current. */
  applied: number;
  /** Set when the session comes from a newer build than this one. */
  fromFuture?: boolean;
}

/**
 * Brings a stored session up to the current version.
 *
 * A session from a *newer* build is handed back untouched rather than mangled:
 * two tabs on two builds is a real situation (one of them refreshed, the other
 * did not), and a downgrade that silently drops fields is worse than a deck
 * that renders with one feature missing.
 */
export function migrate(session: VersionedSession): MigrationResult {
  let current = session;
  let version = versionOf(current);
  let applied = 0;

  if (version > SCHEMA_VERSION) return { session, applied: 0, fromFuture: true };

  while (version < SCHEMA_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) break;
    current = step(current);
    version += 1;
    applied += 1;
  }

  return { session: { ...current, schemaVersion: SCHEMA_VERSION }, applied };
}
