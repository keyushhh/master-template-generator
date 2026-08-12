import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { MasterTemplatePage } from './MasterTemplatePage';
import { HomePage } from './HomePage';
import { ErrorBoundary } from './ErrorBoundary';
import { ToastProvider } from '../features/toast/Toast';

export function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            {/* The gallery is the front door; the studio is where one deck is
                worked on. Splitting them is what lets a deck be found by its
                cover instead of by remembering its name. */}
            <Route path="/" element={<HomePage />} />
            <Route path="/studio" element={<MasterTemplatePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </ErrorBoundary>
  );
}
