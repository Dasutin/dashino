import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const widgetsDir = path.resolve(__dirname, 'widgets');
const assetsDir = path.resolve(__dirname, 'assets');

function watchExternalFiles() {
  return {
    name: 'watch-external-widgets',
    configureServer(server) {
      server.watcher.add([widgetsDir, assetsDir]);
      server.watcher.on('change', file => {
        if (file.startsWith(widgetsDir) || file.startsWith(assetsDir)) {
          server.ws.send({ type: 'full-reload' });
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), watchExternalFiles()],
  root: path.resolve(__dirname, 'web'),
  server: {
    port: 4173,
    fs: {
      allow: [__dirname]
    },
    proxy: {
      '/events': {
        target: 'http://localhost:4040',
        changeOrigin: true
      },
      '/api': {
        target: 'http://localhost:4040',
        changeOrigin: true
      },
      '/widgets': {
        target: 'http://localhost:4040',
        changeOrigin: true
      },
      '/themes': {
        target: 'http://localhost:4040',
        changeOrigin: true
      },
      '/assets': {
        target: 'http://localhost:4040',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: path.resolve(__dirname, 'dist/web'),
    emptyOutDir: true
  }
});
