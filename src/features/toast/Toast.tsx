import { createContext, useCallback, useContext, useRef, useState } from 'react';

type ToastKind = 'error' | 'success' | 'info';

interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

interface ToastContextValue {
  showToast: (message: string, kind?: ToastKind, durationMs?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DURATION_MS: Record<ToastKind, number> = { error: 4000, success: 1800, info: 1800 };

const KIND_COLOR: Record<ToastKind, string> = {
  error: '#dc2626',
  success: 'var(--emerald-500)',
  info: 'var(--neutral-900)',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, kind: ToastKind = 'info', durationMs?: number) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, message, kind }]);
      setTimeout(() => dismiss(id), durationMs ?? DURATION_MS[kind]);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
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
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
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
            <span style={{ flex: 1 }}>{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--neutral-400)',
                fontSize: 16,
                lineHeight: 1,
                padding: 0,
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
