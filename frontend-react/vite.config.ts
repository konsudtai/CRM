import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/auth': 'http://localhost:3001',
      '/accounts': 'http://localhost:3001',
      '/leads': 'http://localhost:3001',
      '/tasks': 'http://localhost:3001',
      '/quotations': 'http://localhost:3001',
      '/products': 'http://localhost:3001',
      '/dashboard': 'http://localhost:3001',
      '/opportunities': 'http://localhost:3001',
      '/pipeline': 'http://localhost:3001',
      '/notifications': 'http://localhost:3001',
      '/activities': 'http://localhost:3001',
      '/users': 'http://localhost:3001',
      '/agents': 'http://localhost:3001',
      '/roles': 'http://localhost:3001',
      '/contacts': 'http://localhost:3001',
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
