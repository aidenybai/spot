import million from 'million/compiler';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [million.vite({ auto: true }), react()],
});
