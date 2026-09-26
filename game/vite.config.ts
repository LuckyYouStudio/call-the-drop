import { defineConfig } from 'vite';

// The game runs inside the host's iframe on a different origin, and the host
// fetches /game.manifest.json cross-origin — CORS must stay open.
export default defineConfig({
  base: './',
  server: { port: 5175, cors: true },
  preview: { port: 5175, cors: true },
  build: { target: 'es2020' },
});
