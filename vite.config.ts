import { defineConfig } from 'vitest/config'

export default defineConfig({
  base: '/companion-expression-editor/',
  test: {
    environment: 'node',
    include: ['test/unit/**/*.test.ts'],
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          blockly: ['blockly/core', 'blockly/blocks'],
        },
      },
    },
  },
})
