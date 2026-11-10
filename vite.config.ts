import { defineConfig } from 'vite';
export default defineConfig({ base: './', assetsInclude: ['**/*.glb', '**/*.hdr', '**/*.m4a'], build: { target: 'es2020', chunkSizeWarningLimit: 900 } });
