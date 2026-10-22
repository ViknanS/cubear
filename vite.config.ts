import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import type { Plugin } from 'vite';

/**
 * cubejs is CoffeeScript-compiled CommonJS wrapped in `(function(){...}).call(this)`. Inside a bundled ES module
 * (strict mode) top-level `this` is undefined, which crashes `this.Cube`. Point the wrapper at globalThis instead.
 */
function cubejsThisFix(): Plugin {
  return {
    name: 'cubejs-this-fix',
    enforce: 'pre',
    transform(code, id) {
      if (!/[\\/]cubejs[\\/]lib[\\/].*\.js$/.test(id)) return null;
      return { code: code.split('}).call(this);').join('}).call(globalThis);'), map: null };
    },
  };
}

// `base: './'` keeps every asset path relative, so the same build works at
// https://<user>.github.io/<repo>/ (GitHub Pages) and at any other sub-path.
export default defineConfig({
  base: './',
  plugins: [cubejsThisFix(), react(), tailwindcss()],
  worker: { format: 'es', plugins: () => [cubejsThisFix()] },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200, // three.js + React; OpenCV.js (~10 MB) is served separately from /vendor and loaded lazily.
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.test.{ts,tsx}', 'tests/fixtures/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    testTimeout: 60000,
  },
});
