import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // The dashboard talks to the Express server on 3001. Proxying in dev keeps
    // the fetch calls origin-relative, so the same code works when the built
    // assets are served from the API itself.
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
});
