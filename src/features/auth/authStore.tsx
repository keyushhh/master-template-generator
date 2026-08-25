import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { DEMO_USERS, findDemoUser, type DemoUser } from './demoUsers';

/**
 * Who is signed in, in this tab.
 *
 * sessionStorage rather than localStorage, deliberately: a session that spans
 * every tab would make it impossible to be two people at once, and being two
 * people at once is the whole point of the sharing and multiplayer work.
 */

const SESSION_KEY = 'wozku-auth-session-v1';

export interface AuthSession {
  userId: string;
  at: number;
}

function readSession(): DemoUser | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    return DEMO_USERS.find((u) => u.id === parsed.userId) ?? null;
  } catch {
    return null;
  }
}

interface AuthValue {
  user: DemoUser | null;
  /** The reason it failed, or null when it worked. */
  signIn: (email: string, password: string) => string | null;
  signOut: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DemoUser | null>(readSession);

  const signIn = useCallback((email: string, password: string): string | null => {
    const match = findDemoUser(email);
    // One message for both, so this doesn't become a way to enumerate accounts.
    if (!match || match.password !== password) return 'That email and password do not match.';
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ userId: match.id, at: Date.now() }));
    } catch {
      // A session that cannot be written still signs in for this page's life.
    }
    setUser(match);
    return null;
  }, []);

  const signOut = useCallback(() => {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // ignore
    }
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, signIn, signOut }), [user, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
