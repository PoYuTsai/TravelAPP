import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tools/ai-room/__tests__/**/*.{test,spec}.mjs'],
  },
})
