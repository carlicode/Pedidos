import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Escuchar en todas las interfaces de red
    port: 5173,      // Puerto por defecto de Vite
    proxy: {
      '/api': {
        // Detectar la IP correcta del servidor backend
        // Si se accede desde la red (192.168.x.x), usar esa IP
        // Si se accede desde localhost, usar localhost
        target: process.env.VITE_BACKEND_URL || 'http://localhost:5055',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
