import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * Bản web nhiều file: gắn tệp public/manifest.webmanifest và biểu tượng iPhone/iPad để "Thêm vào MH chính"
 * mở game toàn màn hình. Bản 1 file (mở bằng file://) không cần và không chép thư mục public/.
 */
function appManifest(): Plugin {
  return {
    name: 'app-manifest',
    transformIndexHtml: () => [
      { tag: 'link', attrs: { rel: 'manifest', href: './manifest.webmanifest' }, injectTo: 'head' },
      { tag: 'link', attrs: { rel: 'apple-touch-icon', href: './apple-touch-icon.png' }, injectTo: 'head' },
    ],
  };
}

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
      copyPublicDir: !single,
    },
    plugins: single ? [viteSingleFile({ removeViteModuleLoader: true })] : [appManifest()],
    test: {
      include: ['tests/**/*.test.ts'],
      environment: 'node',
    },
  };
});
