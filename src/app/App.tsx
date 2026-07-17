import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { MasterTemplatePage } from './MasterTemplatePage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MasterTemplatePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
