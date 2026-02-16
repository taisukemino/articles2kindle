import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['bin/articles2kindle.ts'],
  format: ['esm'],
  target: 'node20',
  outDir: 'dist/bin',
  splitting: false,
  clean: true,
  dts: false,
  sourcemap: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
});
