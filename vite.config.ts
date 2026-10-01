import { defineConfig } from 'vitest/config';
import { viteSingleFile } from 'vite-plugin-singlefile';

// "npm run build"        -> dist/        (bản web nhiều file, dùng cho máy chủ web)
// "npm run build:single" -> dist-single/ (1 file HTML duy nhất, chơi offline bằng cách mở file)
export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  return {
    base: './',
    server: { port: 5173, strictPort: false },
    build: {
      outDir: single ? 'dist-single' : 'dist',
      emptyOutDir: true,
      chunkSizeWarningLimit: 5000,
      assetsInlineLimit: single ? 100_000_000 : 4096,
      cssCodeSplit: !single,
    },
    plugins: single ? [viteSingleFile({ removeViteModuleLoader: true })] : [],
    test: {
      include: ['tests/**/*.test.ts'],
      environment: 'node',
    },
  };
});
