/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { devApi } from './scripts/devApi.ts'

// https://vite.dev/config/
export default defineConfig({
  // devApi serves the functions in api/ during `npm run dev`; it does nothing in a build.
  plugins: [react(), devApi()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
