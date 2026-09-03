import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // Firebase is dynamically imported, so it lands in its own chunk and never
    // blocks the first paint. React stays separate so it caches across deploys.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) return 'react';
          if (id.includes('node_modules/firebase') || id.includes('@firebase')) return 'firebase';
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
});
