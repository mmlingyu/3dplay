import { defineConfig } from 'vite';

// Relative asset paths let html-share serve the build under /play/.
// VITE_BASE is only for the GitHub Pages preview (/3dplay/). Leave it unset for /play/.
const engine = process.env.CREATION_ENGINE_ORIGIN || 'http://localhost:6010';
const base = process.env.VITE_BASE || './';

export default defineConfig({
  base,
  server: {
    // Login pages must be this game's own address, or the browser keeps the
    // session cookie on another host/port and the drawing board stays signed out.
    proxy: {
      '/api': engine,
      '/account': engine,
      '/static': engine,
    },
  },
});
