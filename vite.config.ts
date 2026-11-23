import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' — чтобы сборка открывалась из файлов внутри iOS-приложения (Capacitor)
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { host: true },
})
