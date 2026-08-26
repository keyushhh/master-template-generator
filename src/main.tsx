import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './styles/globals.css';

// Registered only in a build, and only after load: a service worker in dev
// would serve yesterday's bundle over Vite's own, and registering during boot
// competes with the app's first paint for the same connection.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      // No offline support then; the app works exactly as it did before.
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
