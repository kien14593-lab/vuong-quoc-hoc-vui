import { mobileOs } from '../core/device';
import { button, h } from './dom';
import { openModal } from './modal';
import { dismissToasts } from './toast';

/**
 * Toàn màn hình trên mọi máy:
 * - Máy tính, Android, iPad: Fullscreen API (iPad trước iPadOS 16.4 chỉ có bản webkit…).
 * - iPhone: Safari không có Fullscreen API → hướng dẫn "Thêm vào MH chính"; mở game từ biểu tượng đó là toàn màn hình.
 * - Đã mở từ biểu tượng trên màn hình chính (hoặc ứng dụng đã cài chạy toàn màn hình): ẩn mục này.
 */
type FsDoc = Document & {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => void;
};
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => void };

export type DisplayMode = 'browser' | 'minimal-ui' | 'standalone' | 'fullscreen';
export type FullscreenMode = 'hidden' | 'api' | 'guide';

export interface FullscreenEnv {
  /** iOS: đang mở từ biểu tượng trên màn hình chính (navigator.standalone). */
  iosStandalone: boolean;
  /** display-mode của trang (ứng dụng đã cài, phím F11…). */
  display: DisplayMode;
  /** Trình duyệt có Fullscreen API cho cả trang. */
  apiSupported: boolean;
  /** Đang toàn màn hình nhờ Fullscreen API. */
  apiActive: boolean;
  ios: boolean;
}

/** Thuần: mục "Toàn màn hình" hiện nút bật/tắt (`api`), hướng dẫn (`guide`) hay ẩn đi (`hidden`). */
export function fullscreenMode(e: FullscreenEnv): FullscreenMode {
  if (e.iosStandalone) return 'hidden';
  if (e.display === 'fullscreen' && !e.apiActive) return 'hidden';
  if (e.apiSupported) return 'api';
  if (e.display !== 'browser') return 'hidden';
  return e.ios ? 'guide' : 'hidden';
}

function displayMode(): DisplayMode {
  if (typeof matchMedia !== 'function') return 'browser';
  for (const m of ['fullscreen', 'standalone', 'minimal-ui'] as const) {
    if (matchMedia(`(display-mode: ${m})`).matches) return m;
  }
  return 'browser';
}

export function fullscreenSupported(): boolean {
  const d = document as FsDoc;
  return !!(d.fullscreenEnabled || d.webkitFullscreenEnabled);
}

export function isFullscreen(): boolean {
  const d = document as FsDoc;
  return !!(d.fullscreenElement || d.webkitFullscreenElement);
}

export function currentFullscreenMode(): FullscreenMode {
  return fullscreenMode({
    iosStandalone: (navigator as Navigator & { standalone?: boolean }).standalone === true,
    display: displayMode(),
    apiSupported: fullscreenSupported(),
    apiActive: isFullscreen(),
    ios: mobileOs() === 'ios',
  });
}

export async function toggleFullscreen(): Promise<void> {
  const d = document as FsDoc;
  const el = document.documentElement as FsEl;
  try {
    if (isFullscreen()) {
      if (typeof d.exitFullscreen === 'function') await d.exitFullscreen();
      else d.webkitExitFullscreen?.();
    } else if (typeof el.requestFullscreen === 'function') {
      await el.requestFullscreen({ navigationUI: 'hide' });
    } else {
      el.webkitRequestFullscreen?.();
    }
  } catch {
    /* trình duyệt không cho phép */
  }
}

/** Gọi `fn` khi vào/ra toàn màn hình. Trả về hàm hủy. */
export function onFullscreenChange(fn: () => void): () => void {
  document.addEventListener('fullscreenchange', fn);
  document.addEventListener('webkitfullscreenchange', fn);
  return () => {
    document.removeEventListener('fullscreenchange', fn);
    document.removeEventListener('webkitfullscreenchange', fn);
  };
}

/** iPhone: cách thêm game vào màn hình chính để chơi toàn màn hình. */
export function showHomeScreenGuide(): Promise<void> {
  dismissToasts();
  const m = openModal({
    title: 'Chơi toàn màn hình',
    icon: '📲',
    width: 1100,
    className: 'modal-small',
    body: h(
      'div.fs-guide',
      h(
        'ol.fs-steps',
        h('li', 'Mở game bằng ', h('b', 'Safari'), '. Nếu đang mở trong Zalo, Facebook…: bấm nút có dấu ba chấm → chọn mở bằng Safari (trình duyệt).'),
        h('li', 'Bấm nút ', h('b', 'Chia sẻ'), ' (ô vuông có mũi tên đi lên; không thấy thì bấm nút ba chấm trước) → chọn ', h('b', '“Thêm vào MH chính”'), ' → bấm ', h('b', '“Thêm”'), '.'),
        h('li', 'Mở game từ biểu tượng ', h('b', '“Học Vui”'), ' trên màn hình chính: game chiếm trọn màn hình.'),
      ),
      h(
        'p.fs-note',
        '💾 Game mở từ biểu tượng lưu tiến độ riêng. Muốn chơi tiếp hồ sơ cũ: trong Safari vào 👪 Góc phụ huynh → Quản lý → “Xuất hồ sơ JSON”; rồi trong game mới mở 👪 Góc phụ huynh → “Nhập hồ sơ JSON”.',
      ),
    ),
    footer: button('Đã hiểu', () => m.close(), 'btn-primary'),
  });
  return m.closed;
}

/**
 * Dòng "Toàn màn hình" trong Cài đặt (null khi không cần). `dispose` gỡ theo dõi khi đóng Cài đặt.
 */
export function fullscreenRow(): { row: HTMLElement | null; dispose: () => void } {
  const mode = currentFullscreenMode();
  if (mode === 'hidden') return { row: null, dispose: () => undefined };
  if (mode === 'guide') {
    return {
      row: h('div.set-row', h('span.set-label', '📱 Toàn màn hình'), button('📲 Cách làm', () => void showHomeScreenGuide(), 'btn-small btn-blue')),
      dispose: () => undefined,
    };
  }
  const label = () => (isFullscreen() ? 'Thu nhỏ' : 'Phóng to');
  const btn = button(label(), () => void toggleFullscreen(), 'btn-small btn-blue');
  const off = onFullscreenChange(() => (btn.textContent = label()));
  return { row: h('div.set-row', h('span.set-label', '🖥️ Toàn màn hình'), btn), dispose: off };
}
