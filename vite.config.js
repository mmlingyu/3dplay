import { defineConfig } from 'vite';

// Relative asset paths let html-share serve the build under /play/.
const engine = process.env.CREATION_ENGINE_ORIGIN || 'http://localhost:6010';

export default defineConfig({
  base: './',
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
