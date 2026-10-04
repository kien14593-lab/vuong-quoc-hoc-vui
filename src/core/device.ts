/** Điện thoại / máy tính bảng (để hiện đúng hướng dẫn tải giọng đọc tiếng Việt). */
export type MobileOs = 'ios' | 'android';

/** Thuần: nhận dạng từ userAgent. iPad đời mới báo platform "MacIntel" nhưng có màn hình cảm ứng. */
export function detectMobileOs(ua: string, platform = '', maxTouchPoints = 0): MobileOs | null {
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua) || (platform === 'MacIntel' && maxTouchPoints > 1)) return 'ios';
  return null;
}

export function mobileOs(): MobileOs | null {
  if (typeof navigator === 'undefined') return null;
  return detectMobileOs(navigator.userAgent ?? '', navigator.platform ?? '', navigator.maxTouchPoints ?? 0);
}

/**
 * Thuần: máy cảm ứng (điện thoại, máy tính bảng) – để chọn cách vẽ 3D và cách chạm hợp với máy.
 * Cần màn hình cảm ứng đa điểm và con trỏ chính là ngón tay (pointer: coarse). iPad đời mới báo mình là máy Mac
 * nên chỉ cần có màn hình cảm ứng. Máy tính xách tay có màn hình cảm ứng nhưng dùng chuột / bàn di chuột: không tính.
 * Trình duyệt không báo số điểm chạm (maxTouchPoints = 0) nhưng có sự kiện chạm và con trỏ là ngón tay: vẫn tính.
 */
export function detectTouch(coarse: boolean, maxTouchPoints: number, ua: string, platform = '', touchEvents = false): boolean {
  if (maxTouchPoints < 2) return maxTouchPoints === 0 && coarse && touchEvents;
  return coarse || /Macintosh/.test(ua) || platform === 'MacIntel';
}

let touch: boolean | null = null;

export function isTouchDevice(): boolean {
  if (touch !== null) return touch;
  if (typeof navigator === 'undefined') return (touch = false);
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const touchEvents = typeof window !== 'undefined' && 'ontouchstart' in window;
  touch = detectTouch(coarse, navigator.maxTouchPoints ?? 0, navigator.userAgent ?? '', navigator.platform ?? '', touchEvents);
  return touch;
}
