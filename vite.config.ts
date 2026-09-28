import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  // Served from imagreece.gr (root), via the CNAME file in public/.
  base: '/',
  plugins: [react(), tailwindcss()],
  // Module workers (src/components/hero/edges.worker.ts). Every browser that
  // can run the WebGL scene can run these.
  worker: {
    format: 'es',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
