import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Menyajikan `dist/player.html` (shell player mandiri) di server dev,
 * supaya tombol "Ekspor satu file" di Studio bisa dipakai tanpa deploy.
 */
function servePlayerShell(): Plugin {
  return {
    name: 'au-serve-player-shell',
    configureServer(server) {
      server.middlewares.use(
        '/player.html',
        (_req: IncomingMessage, res: ServerResponse, next: (error?: unknown) => void) => {
          const file = resolve(process.cwd(), 'dist/player.html');
          if (!existsSync(file)) return next();
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(readFileSync(file));
        },
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), servePlayerShell()],
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    setupFiles: ['tests/setup.ts'],
  },
});
