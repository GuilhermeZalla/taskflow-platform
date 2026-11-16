import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import envCompatible from 'vite-plugin-env-compatible';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  base: process.env.VITE_PUBLIC_DEMO === 'true' ? '/taskflow-platform/' : '/',
  plugins: [react(), envCompatible(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      src: path.resolve(import.meta.dirname, './src'),
    },
  },
});
