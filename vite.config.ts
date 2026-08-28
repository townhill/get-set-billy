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
    chunkSizeWarningLimit: 1500,
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
