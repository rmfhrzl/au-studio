import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath, URL } from 'node:url';

/**
 * Build "player only".
 *
 * Menghasilkan SATU file HTML mandiri: React, CSS, dan runtime pemain
 * semuanya di-inline. Tidak ada aset eksternal, tidak ada permintaan
 * jaringan — persis seperti AU phone-sim yang dikirim sebagai satu file
 * dan bisa di-host di hosting statis mana pun (s termasuk hosting免费
 * untuk mahasiswa).
 */
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist-player',
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      input: fileURLToPath(new URL('./player.html', import.meta.url)),
      output: {
        inlineDynamicImports: true,
        entryFileNames: 'player.js',
        assetFileNames: 'player.[ext]',
      },
    },
  },
});
