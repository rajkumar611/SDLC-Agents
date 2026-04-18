import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/pipeline': { target: 'http://localhost:3010', changeOrigin: true },
      '/audit':    { target: 'http://localhost:3010', changeOrigin: true },
      '/governance': { target: 'http://localhost:3010', changeOrigin: true },
      '/dev':        { target: 'http://localhost:3010', changeOrigin: true },
    },
  },
});
