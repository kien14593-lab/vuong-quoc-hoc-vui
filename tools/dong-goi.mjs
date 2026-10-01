// Chép bản 1-tệp (dist-single/index.html) sang ban-phat-hanh/VuongQuocToanHoc.html
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(ROOT, 'dist-single', 'index.html');
if (!fs.existsSync(src)) {
  console.error('  ✖ Không thấy dist-single/index.html – hãy chạy "npm run build:single" trước.');
  process.exit(1);
}
const outDir = path.join(ROOT, 'ban-phat-hanh');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'VuongQuocToanHoc.html');
fs.copyFileSync(src, out);
const mb = (fs.statSync(out).size / 1024 / 1024).toFixed(1);
console.log('');
console.log(`  ✔ Đã đóng gói xong: ${out}  (${mb} MB)`);
console.log('    Mở tệp này bằng Chrome hoặc Edge để chơi – không cần Internet, không cần cài đặt.');
console.log('    Có thể chép sang máy khác qua USB, Zalo, Google Drive...');
