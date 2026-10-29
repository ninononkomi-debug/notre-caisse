import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Version démo en un seul fichier HTML (pour un lien à partager)
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
  define: { 'import.meta.env.VITE_DEMO': JSON.stringify('1') },
  build: { outDir: 'dist-demo', target: 'es2020', assetsInlineLimit: 100000000 },
});
