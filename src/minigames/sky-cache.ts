import type * as THREE from 'three';

/**
 * Ảnh bầu trời của các lượt chơi gần đây (khóa: màu đỉnh trời|chân trời), dùng lại ở lượt sau. Lần đầu vẽ một ảnh bầu trời,
 * three đổi nó sang khối lập phương 256² bằng một shader riêng rồi hủy shader đó ngay – ảnh mới nào cũng phải biên dịch lại,
 * khựng đúng khung hình trò bắt đầu (lượt chơi sau không có màn che). Ảnh cũ thì đã đổi rồi: không đổi, không biên dịch nữa.
 * Giữ tối đa SKY_KEEP ảnh (mỗi ảnh kèm khối lập phương ~1,5 MB bộ nhớ đồ họa); ảnh bị đẩy ra thì hủy.
 */
export const SKY_KEEP = 3;
const skies = new Map<string, THREE.Texture>();

/** Ảnh bầu trời cho khóa màu `key`: ảnh đang giữ (bỏ ảnh mới `fresh`, chưa lên GPU) hoặc giữ luôn `fresh`. */
export function keepSky(key: string, fresh: THREE.Texture): THREE.Texture {
  const kept = skies.get(key);
  skies.delete(key);
  if (kept) fresh.dispose();
  skies.set(key, kept ?? fresh);
  for (const [k, t] of skies) {
    if (skies.size <= SKY_KEEP) break;
    skies.delete(k);
    t.dispose();
  }
  return kept ?? fresh;
}

/** Hủy ảnh bầu trời không dùng nữa – trừ ảnh đang giữ cho lượt sau. */
export function dropSky(bg: THREE.Scene['background']): void {
  const t = bg as THREE.Texture | null;
  if (t?.isTexture && ![...skies.values()].includes(t)) t.dispose();
}
