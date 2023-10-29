import million from 'million/compiler';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        pose: resolve(__dirname, 'pose.html'),
        gesture: resolve(__dirname, 'gesture.html'),
      },
    },
  },
  plugins: [million.vite({ auto: true }), react()],
});
