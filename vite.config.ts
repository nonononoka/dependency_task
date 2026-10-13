import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// base を相対パスにして、GitHub Pages のリポジトリ名に依存しないようにする
export default defineConfig({
  base: './',
  plugins: [react()],
  test: { environment: 'node' },
});
