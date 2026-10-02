import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// En local, l'API .NET tourne sur :5081 (dotnet run). En production, CloudFront route /api/* vers la Lambda.
// Deux pages HTML (/ en français, /en/ en anglais) : chacune a ses balises SEO, le code React est partagé.
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        fr: resolve(import.meta.dirname, 'index.html'),
        en: resolve(import.meta.dirname, 'en/index.html'),
      },
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:5081',
    },
  },
})
