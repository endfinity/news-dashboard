import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environmentMatchGlobs: [
      ['tests/app.test.js', 'jsdom'],
      ['tests/server.test.js', 'node'],
    ],
    setupFiles: ['./tests/setup.js'],
  },
});
