import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Pinned (not just default) because the PDF backend's headless Chrome
    // navigates to this exact port — a silent fallback to another port would
    // desync the two and break PDF export.
    port: 5173,
    strictPort: false,
    // Forward PDF-export calls to the local headless-Chrome service so the
    // frontend can use a same-origin `/api` path (no CORS in dev).
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
