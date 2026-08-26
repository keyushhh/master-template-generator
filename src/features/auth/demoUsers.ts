/**
 * The people you can sign in as.
 *
 * Hardcoded on purpose: this build has no backend, and the point of having
 * several is that two browser tabs can be signed in as two different people at
 * once, which is the only way the sharing and multiplayer work can be seen at
 * all. Swap this file for a real users table when the backend lands.
 */

export interface DemoUser {
  id: string;
  name: string;
  email: string;
  password: string;
  /** Marks this person's cursor and avatar wherever they show up. */
  color: string;
}

// Avatar colours are grounds for white initials, so each one has to clear AA
// against white: the emerald and amber the app uses elsewhere are 2.5:1 and
// 2.2:1, which made the initials decorative rather than readable.
export const DEMO_USERS: DemoUser[] = [
  { id: 'u_admin', name: 'Admin User', email: 'admin@wozku.local', password: '1234', color: '#7C3AED' },
  { id: 'u_designer', name: 'Studio Designer', email: 'designer@wozku.local', password: '1234', color: '#047857' },
  { id: 'u_reviewer', name: 'Client Reviewer', email: 'reviewer@wozku.local', password: '1234', color: '#B45309' },
];

export function findDemoUser(email: string): DemoUser | undefined {
  const clean = email.trim().toLowerCase();
  return DEMO_USERS.find((u) => u.email.toLowerCase() === clean);
}

export function userById(id: string | undefined): DemoUser | undefined {
  return id ? DEMO_USERS.find((u) => u.id === id) : undefined;
}

/** Two initials for an avatar chip. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'WU';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
