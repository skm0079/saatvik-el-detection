// file: vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'


// const __dirname = path.dirname(fileURLToPath(import.meta.url))
const __dirname = new URL('.', import.meta.url).pathname

export default defineConfig({
  plugins: [react()],
  
  // Build to FastAPI static directory
  build: {
    outDir: '../app/static',
    emptyOutDir: true
  },

  // Development server
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000',
      '/processed': 'http://localhost:8000'
    }
  },

  resolve: {
    alias: {
      '@': `${__dirname}src`
    }
  }
})