import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The tested modules are all pure logic: no canvas, no WebGL, no Phaser.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
