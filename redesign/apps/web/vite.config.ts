import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const target = process.env.UNITE_API ?? 'http://localhost:4310';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 4311,
    strictPort: true,
    proxy: {
      '/api': { target, changeOrigin: true },
      '/healthz': { target, changeOrigin: true },
    },
  },
  build: { outDir: 'dist', sourcemap: false },
});
