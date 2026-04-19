import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  base: '/m/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5174,
    allowedHosts: ['mufend.com', 'www.mufend.com', '103.43.188.127', 'localhost'],
    hmr: {
      clientPort: 80,
      protocol: 'ws',
    },
    proxy: {
      '/api': {
        target: 'http://103.43.188.127:3000',
        changeOrigin: true,
      },
    },
  },
})
