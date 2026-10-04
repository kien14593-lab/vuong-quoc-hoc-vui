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
