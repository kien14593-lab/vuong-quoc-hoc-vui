/**
 * Tải lười bộ câu hỏi Tiếng Anh (ngân hàng từ là dữ liệu khá lớn – chỉ tải khi hồ sơ học Tiếng Anh).
 * Bản web tách thành tệp riêng; bản một tệp nhúng sẵn nên vẫn chạy ngoại tuyến.
 */
export type EnglishModule = typeof import('./gen');

let mod: EnglishModule | null = null;
let pending: Promise<EnglishModule> | null = null;

export function loadEnglish(): Promise<EnglishModule> {
  if (mod) return Promise.resolve(mod);
  if (!pending) {
    pending = import('./gen').then(
      (m) => {
        mod = m;
        return m;
      },
      (e) => {
        pending = null;
        throw e;
      },
    );
  }
  return pending;
}

/** Bộ câu hỏi nếu đã tải xong (null nếu chưa). */
export function english(): EnglishModule | null {
  return mod;
}
