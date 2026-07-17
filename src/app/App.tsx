import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { MasterTemplatePage } from './MasterTemplatePage';
import { PrintDeckPage } from './PrintDeckPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MasterTemplatePage />} />
        <Route path="/print" element={<PrintDeckPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
