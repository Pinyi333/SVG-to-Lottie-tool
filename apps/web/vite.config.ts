import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * `base` has to match the repository name for GitHub Pages project sites,
 * which serve from a subdirectory. It is overridable so a fork under a
 * different name, or a deploy to a custom domain, does not need a code change.
 */
const base = process.env.PUBLIC_BASE_PATH ?? '/SVG-to-Lottie-tool/';

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
