import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset URLs, so the built game works from any path nginx serves it at.
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    // Phaser is large and ships as one chunk; this keeps the build output quiet.
    // Nearly all of the bundle is Phaser, so the limit leaves the game's own
    // code room to grow rather than sitting a few kilobytes above it.
    chunkSizeWarningLimit: 1600,
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true,
  },
});
