import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  publicDir: false,
  build: {
    outDir: 'public/game',
    emptyOutDir: false,
    sourcemap: false,
    minify: 'esbuild',
    lib: {
      entry: 'game-src/main.js',
      formats: ['es'],
      fileName: () => 'game.js',
    },
  },
});
