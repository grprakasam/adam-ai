import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: { rollupOptions: { input: { main: 'index.html', agent: 'agent.html' } } },
  server: {
    port: 3000,
    strictPort: true,
    host: true,
    open: false,
    proxy: {
      '/api': {
        target: 'http://localhost:8002',
        changeOrigin: true,
      }
    }
  }
})
