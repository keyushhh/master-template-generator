import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from './ErrorBoundary';
import { ToastProvider } from '../features/toast/Toast';
import { FitDevShortcut } from '../features/fit/FitDevShortcut';
import { AuthProvider } from '../features/auth/authStore';
import { RequireAuth } from '../features/auth/RequireAuth';
import { LoginPage } from '../features/auth/LoginPage';

// Loaded on the route that needs it, not both up front: the studio (canvas,
// toolbar, all 14 template renderers) is most of the app's code and has no
// business downloading before someone has opened a deck to work on.
const HomePage = lazy(() => import('./HomePage').then((m) => ({ default: m.HomePage })));
const MasterTemplatePage = lazy(() =>
  import('./MasterTemplatePage').then((m) => ({ default: m.MasterTemplatePage }))
);

export function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <FitDevShortcut />
        <BrowserRouter>
          <AuthProvider>
            <Suspense fallback={<div style={{ position: 'fixed', inset: 0, background: '#fff' }} />}>
              <Routes>
                {/* The gallery is the front door; the studio is where one deck is
                    worked on. Splitting them is what lets a deck be found by its
                    cover instead of by remembering its name. */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/" element={<RequireAuth><HomePage /></RequireAuth>} />
                <Route path="/studio" element={<RequireAuth><MasterTemplatePage /></RequireAuth>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </ErrorBoundary>
  );
}
