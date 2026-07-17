import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './AppShell';
import { ProjectWorkspace } from '../features/projects/ProjectWorkspace';
import { ProjectOverview } from '../features/projects/ProjectOverview';
import { BusinessRecordImport } from '../features/business-record/BusinessRecordImport';
import {
  PresentationsPlaceholder,
  AssetsPlaceholder,
  ExportsPlaceholder,
  SettingsPlaceholder,
} from '../features/projects/Placeholders';
import { ProjectsProvider } from '../features/projects/ProjectsProvider';

export function App() {
  return (
    <BrowserRouter>
      <ProjectsProvider>
        <Routes>
          <Route path="/" element={<AppShell />} />
          <Route path="/projects/:projectId" element={<ProjectWorkspace />}>
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="overview" element={<ProjectOverview />} />
            <Route path="business-record" element={<BusinessRecordImport />} />
            <Route path="presentations" element={<PresentationsPlaceholder />} />
            <Route path="assets" element={<AssetsPlaceholder />} />
            <Route path="exports" element={<ExportsPlaceholder />} />
            <Route path="settings" element={<SettingsPlaceholder />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ProjectsProvider>
    </BrowserRouter>
  );
}
