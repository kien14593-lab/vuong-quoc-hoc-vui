/**
 * Phông chữ dùng chung (giao diện: Baloo 2; chữ trên mô hình 3D: Nunito).
 *
 * Tự khai báo @font-face kèm unicode-range thay vì nhập các tệp CSS theo bộ ký tự của @fontsource
 * (vd. "vietnamese-800.css"): các tệp đó không có unicode-range nên trình duyệt dùng nhầm bộ latin
 * cho chữ có dấu – "cần" hiện thành "cân" (mất dấu huyền trên "ầ").
 */
import b500l from '@fontsource/baloo-2/files/baloo-2-latin-500-normal.woff2?url';
import b500v from '@fontsource/baloo-2/files/baloo-2-vietnamese-500-normal.woff2?url';
import b600l from '@fontsource/baloo-2/files/baloo-2-latin-600-normal.woff2?url';
import b600v from '@fontsource/baloo-2/files/baloo-2-vietnamese-600-normal.woff2?url';
import b700l from '@fontsource/baloo-2/files/baloo-2-latin-700-normal.woff2?url';
import b700v from '@fontsource/baloo-2/files/baloo-2-vietnamese-700-normal.woff2?url';
import b800l from '@fontsource/baloo-2/files/baloo-2-latin-800-normal.woff2?url';
import b800v from '@fontsource/baloo-2/files/baloo-2-vietnamese-800-normal.woff2?url';
import n700l from '@fontsource/nunito/files/nunito-latin-700-normal.woff2?url';
import n700v from '@fontsource/nunito/files/nunito-vietnamese-700-normal.woff2?url';
import n800l from '@fontsource/nunito/files/nunito-latin-800-normal.woff2?url';
import n800v from '@fontsource/nunito/files/nunito-vietnamese-800-normal.woff2?url';
import n900l from '@fontsource/nunito/files/nunito-latin-900-normal.woff2?url';
import n900v from '@fontsource/nunito/files/nunito-vietnamese-900-normal.woff2?url';

const LATIN =
  'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const VIET =
  'U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB';

/** Chuỗi mẫu để nạp đủ cả bộ latin lẫn bộ tiếng Việt (dùng cho chữ vẽ lên canvas). */
export const FONT_SAMPLE = 'Aa1 ăâđêôơư ầếịọủ';

const FACES: [family: string, weight: number, latin: string, viet: string][] = [
  ['Baloo 2', 500, b500l, b500v],
  ['Baloo 2', 600, b600l, b600v],
  ['Baloo 2', 700, b700l, b700v],
  ['Baloo 2', 800, b800l, b800v],
  ['Nunito', 700, n700l, n700v],
  ['Nunito', 800, n800l, n800v],
  ['Nunito', 900, n900l, n900v],
];

const face = (family: string, weight: number, url: string, range: string) =>
  `@font-face{font-family:'${family}';font-style:normal;font-display:swap;font-weight:${weight};src:url(${url}) format('woff2');unicode-range:${range};}`;

if (typeof document !== 'undefined' && !document.getElementById('vqth-fonts')) {
  const style = document.createElement('style');
  style.id = 'vqth-fonts';
  // Bộ tiếng Việt khai báo sau → được ưu tiên ở các mã trùng (U+0304, U+0308, U+0329).
  style.textContent = FACES.map(([f, w, l, v]) => face(f, w, l, LATIN) + face(f, w, v, VIET)).join('\n');
  document.head.prepend(style);
}
