import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// En local, l'API .NET tourne sur :5081 (dotnet run). En production, CloudFront route /api/* vers la Lambda.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:5081',
    },
  },
})
