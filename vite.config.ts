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

/**
 * Phông chữ phải có trước khi mở màn hình tiêu đề: chữ vẽ lên mô hình 3D (engine/text.ts loadFonts: Baloo 2 800,
 * Nunito 700/800/900) và chữ màn hình khởi động (styles/main.css .boot-title 800, .boot-text 600) – cả bộ latin lẫn
 * bộ tiếng Việt. Đổi phông ở đó thì sửa cả ở đây. Chữ màn hình tiêu đề (Baloo 2 700) không có ở đây: main.ts bắt đầu
 * tải nhưng không chờ (engine/text.ts preloadTitleFonts) – thêm vào đây thì mã game tải chậm hơn, màn hình tiêu đề mở trễ.
 */
const BOOT_FONTS = /^(baloo-2-(latin|vietnamese)-(600|800)|nunito-(latin|vietnamese)-(700|800|900))-normal-[\w-]+\.woff2$/;

/**
 * Bản web nhiều file: tải sẵn các phông trên ngay từ đầu, cùng lúc với mã game. Không có thì trình duyệt chỉ biết đến
 * phông sau khi tải và chạy xong mã game (styles/fonts.ts khai báo @font-face) – mạng chậm, màn hình tiêu đề mở trễ
 * thêm 1–2 giây. Bản 1 file: phông nằm sẵn trong file.
 */
function fontPreload(): Plugin {
  return {
    name: 'font-preload',
    transformIndexHtml: {
      order: 'post',
      handler: (_html, ctx) =>
        Object.keys(ctx.bundle ?? {})
          .filter((f) => BOOT_FONTS.test(f.slice(f.lastIndexOf('/') + 1)))
          .sort()
          .map((f) => ({
            tag: 'link',
            attrs: { rel: 'preload', href: `./${f}`, as: 'font', type: 'font/woff2', crossorigin: true },
            injectTo: 'head',
          })),
    },
  };
}

/**
 * Trình duyệt thấp nhất: iPhone/iPad từ iOS 15.4 (iPhone 6s/7/SE đời đầu, iPad Air 2, iPad mini 4 lên được iOS 15.8).
 * Mặc định của Vite là Safari 16.4: mã three.js có cú pháp mới (khối static trong class) mà Safari cũ không đọc được –
 * cả file mã game hỏng. Hạ xuống thì lúc dựng tự viết lại các cú pháp đó; CSS cũng dựng theo mức này.
 * Lookbehind trong regex thì không viết lại được: đừng dùng (tests/old-safari.test.ts kiểm tra).
 */
const TARGET = ['chrome111', 'edge111', 'firefox114', 'safari15.4', 'ios15.4'];

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
      target: TARGET,
      chunkSizeWarningLimit: 5000,
      assetsInlineLimit: single ? 100_000_000 : 4096,
      cssCodeSplit: !single,
      copyPublicDir: !single,
    },
    plugins: single ? [viteSingleFile({ removeViteModuleLoader: true })] : [appManifest(), fontPreload()],
    test: {
      include: ['tests/**/*.test.ts'],
      environment: 'node',
    },
  };
});
