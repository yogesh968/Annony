import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react({ jsxImportSource: 'react' })],
  resolve: {
    extensions: ['.js', '.jsx', '.json']
  },
  // Server config only for development
  server: {
    host: true,
    port: 5173,
    strictPort: true
  },
  // Preview config for production preview
  preview: {
    host: true,
    port: parseInt(process.env.PORT) || 4173,
    strictPort: false
  }
})
