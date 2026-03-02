import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/neurons': 'http://127.0.0.1:8002',
      '/queries': 'http://127.0.0.1:8002',
      '/query': 'http://127.0.0.1:8002',
      '/admin': 'http://127.0.0.1:8002',
      '/health': 'http://127.0.0.1:8002',
      '/eval-scores': 'http://127.0.0.1:8002',
    },
  },
})
