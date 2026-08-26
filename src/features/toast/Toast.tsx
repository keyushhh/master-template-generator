import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AlertIcon, CheckCircleIcon, InfoIcon } from '../ui/icons';

type ToastKind = 'error' | 'success' | 'info';

interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

interface ToastContextValue {
  showToast: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DURATION_MS: Record<ToastKind, number> = { error: 7000, success: 3500, info: 4500 };

const KIND_COLOR: Record<ToastKind, string> = {
  error: '#dc2626',
  success: 'var(--emerald-500)',
  info: 'var(--neutral-900)',
};

const KIND_ICON: Record<ToastKind, React.ComponentType<{ size?: number }>> = {
  error: AlertIcon,
  success: CheckCircleIcon,
  info: InfoIcon,
};

/** More than this many at once is not "here's what happened", it's noise -
 *  a burst of failed exports should say so once, not scroll the screen. */
const MAX_VISIBLE = 4;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      const id = ++idRef.current;
      setToasts((prev) => {
        // The same message piling up (a repeated failure) reads as one toast
        // that survives, not a stack of identical ones.
        const already = prev.find((t) => t.message === message && t.kind === kind);
        const rest = already ? prev.filter((t) => t.id !== already.id) : prev;
        const next = [...rest, { id, message, kind }];
        return next.slice(-MAX_VISIBLE);
      });
      setTimeout(() => dismiss(id), DURATION_MS[kind]);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        style={{
          position: 'fixed',
          top: 20,
          right: 20,
          zIndex: 300,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          maxWidth: 380,
        }}
      >
        {toasts.map((t) => {
          const Icon = KIND_ICON[t.kind];
          return (
          <div
            key={t.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '12px 14px',
              background: '#fff',
              border: `1px solid ${KIND_COLOR[t.kind]}`,
              borderLeft: `4px solid ${KIND_COLOR[t.kind]}`,
              borderRadius: 'var(--radius-sharp)',
              boxShadow: 'var(--shadow-lift)',
              fontSize: 13,
              lineHeight: 1.4,
              color: 'var(--neutral-800)',
            }}
          >
            <span aria-hidden style={{ flexShrink: 0, marginTop: 1, color: KIND_COLOR[t.kind] }}>
              <Icon size={15} />
            </span>
            <span style={{ flex: 1 }}>{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--neutral-600)',
                fontSize: 16,
                lineHeight: 1,
                padding: 0,
              }}
            >
              ×
            </button>
          </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
