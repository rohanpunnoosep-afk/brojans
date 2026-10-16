import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => {
  // Server-only configuration; never exposed through Vite's VITE_* client env.
  const env = loadEnv(mode, '.', 'TANDEM_');
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: env.TANDEM_BACKEND_URL || 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
      },
    },
  };
});
