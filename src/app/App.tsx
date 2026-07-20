import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { MasterTemplatePage } from './MasterTemplatePage';
import { ErrorBoundary } from './ErrorBoundary';
import { ToastProvider } from '../features/toast/Toast';

export function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<MasterTemplatePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </ErrorBoundary>
  );
}
