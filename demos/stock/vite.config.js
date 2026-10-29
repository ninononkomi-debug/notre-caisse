import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath } from 'url';
const root = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({
  root, base: './',
  plugins: [react(), ...(process.env.SINGLE ? [viteSingleFile()] : [])],
  build: { outDir: process.env.OUT || 'dist', emptyOutDir: true, target: 'es2020', assetsInlineLimit: process.env.SINGLE ? 100000000 : 4096 },
});
