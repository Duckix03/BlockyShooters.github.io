import { defineConfig } from 'vite';

// Headers de isolamento cross-origin: liberam SharedArrayBuffer no dev/preview.
// No GitHub Pages (que não deixa configurar headers) quem faz isso é o public/coi-sw.js.
const isolamento = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export default defineConfig({
  // Caminho relativo: funciona em https://usuario.github.io/<repo>/ sem configurar nada.
  base: './',
  server: { headers: isolamento },
  preview: { headers: isolamento },
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 3000,
  },
  optimizeDeps: { exclude: ['@dimforge/rapier3d-compat'] },
});
