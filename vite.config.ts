import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // GitHub Pages serves this repo from /IMA/, so built asset URLs need that
  // prefix. Dev stays at / — the dev server isn't behind the subpath.
  // Anything reading this at runtime should use import.meta.env.BASE_URL
  // rather than hardcoding it, so both modes work. Drop this to '/' if the
  // site ever moves to its own domain.
  base: command === 'build' ? '/IMA/' : '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
}))
