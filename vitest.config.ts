import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['app/**/__tests__/**/*.{test,spec}.{ts,tsx,js,jsx}', 'app/**/*.{test,spec}.{ts,tsx,js,jsx}'],
    exclude: ['e2e/**', 'node_modules', '.next/**', 'dist/**'],
    setupFiles: ['./vitest.setup.ts'],
  },
});
