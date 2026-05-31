import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    // Only the real suite lives under src/. Scoping include here (rather than
    // maintaining an ever-growing exclude blocklist) keeps git-ignored dirs out
    // of the run for good: .worktrees/ (parallel-agent worktrees), browser
    // profile data dirs, and Playwright's e2e/ (run separately via Playwright).
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
