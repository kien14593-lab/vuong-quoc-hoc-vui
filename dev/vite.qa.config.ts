import { mergeConfig, type UserConfig } from 'vite';
import base from '../vite.config';

/**
 * Máy chủ thử nghiệm KHÔNG tự tải lại trang khi tệp thay đổi (dùng khi nhiều người cùng sửa mã
 * và chụp ảnh kiểm tra – trang đang chạy không bị làm mới giữa chừng; mỗi lần mở trang mới vẫn
 * nhận mã mới nhất).
 *
 *   npx vite --config dev/vite.qa.config.ts      → http://127.0.0.1:5174/dev/zone.html?zone=forest
 */
export default (env: { command: 'build' | 'serve'; mode: string; isSsrBuild?: boolean; isPreview?: boolean }): UserConfig => {
  const b = typeof base === 'function' ? base(env) : base;
  return mergeConfig(b as UserConfig, { server: { hmr: false, port: 5174, strictPort: true, host: '127.0.0.1' } });
};
