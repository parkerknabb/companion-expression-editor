import { defineConfig } from 'vitest/config'

export default defineConfig({
  base: '/companion-expression-editor/',
  test: {
    environment: 'jsdom',
    include: ['test/unit/**/*.test.ts'],
  },
})
