import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { buildInfoPlugin } from './plugins/build-info'

export default defineConfig({
  plugins: [react(), buildInfoPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@services': path.resolve(__dirname, './src/services'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@types': path.resolve(__dirname, './src/types'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-antd': ['antd', '@ant-design/icons', '@ant-design/pro-components'],
          'vendor-chart': ['echarts', 'echarts-for-react'],
          'vendor-kline': ['klinecharts', 'lightweight-charts'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
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
