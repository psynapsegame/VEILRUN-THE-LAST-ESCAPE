import { defineConfig } from 'vite';
export default defineConfig({ base: './', assetsInclude: ['**/*.glb', '**/*.hdr'], build: { target: 'es2020', chunkSizeWarningLimit: 900 } });
