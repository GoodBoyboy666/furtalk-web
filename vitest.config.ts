import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    setupFiles: ['./src/test-setup.ts'],
  },
})
