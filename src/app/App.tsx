import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './AppShell';
import { ProjectWorkspace } from '../features/projects/ProjectWorkspace';
import { ProjectsProvider } from '../features/projects/ProjectsProvider';

export function App() {
  return (
    <BrowserRouter>
      <ProjectsProvider>
        <Routes>
          <Route path="/" element={<AppShell />} />
          <Route path="/projects/:projectId" element={<ProjectWorkspace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ProjectsProvider>
    </BrowserRouter>
  );
}
