import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  base: '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5174,
    allowedHosts: ['duokeer.com', 'www.duokeer.com', 'mufend.com', 'www.mufend.com', '103.43.188.127', 'localhost'],
    hmr: {
      clientPort: 80,
      protocol: 'ws',
    },
    proxy: {
      '/api': {
        target: 'http://103.43.188.127:3000',
        changeOrigin: true,
      },
      // 代理上传图片资源
      '/uploads': {
        target: 'http://103.43.188.127:3000',
        changeOrigin: true,
      },
    },
  },
})
