import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backend = (env.VITE_API_URL || 'https://stela-backend.vercel.app').trim()

  return {
    plugins: [react(), tailwindcss()],
    server: {
      // Proxy de desarrollo: evita CORS redirigiendo /api al backend
      proxy: {
        '/api': {
          target: backend,
          changeOrigin: true,
          secure: true,
        },
      },
    },
  }
})
