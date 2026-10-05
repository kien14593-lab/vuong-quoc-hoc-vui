import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/ui/modal', () => ({ openModal: () => ({ closed: Promise.resolve(), close: () => undefined }) }));
vi.mock('../src/ui/toast', () => ({ dismissToasts: () => undefined }));

import { fullscreenMode, type FullscreenEnv } from '../src/ui/fullscreen';

const env = (o: Partial<FullscreenEnv> = {}): FullscreenEnv => ({ iosStandalone: false, display: 'browser', apiSupported: true, apiActive: false, ios: false, ...o });

/** Mục "Toàn màn hình" trong Cài đặt (ui/fullscreen.ts). */
describe('fullscreenMode', () => {
  it('máy tính, Android, iPad: nút Phóng to / Thu nhỏ như cũ', () => {
    expect(fullscreenMode(env())).toBe('api');
    // Chrome báo display-mode: fullscreen khi đang toàn màn hình bằng nút → vẫn phải còn nút "Thu nhỏ".
    expect(fullscreenMode(env({ display: 'fullscreen', apiActive: true }))).toBe('api');
    expect(fullscreenMode(env({ ios: true }))).toBe('api');
    // Ứng dụng đã cài trên máy tính (cửa sổ riêng): vẫn phóng to được.
    expect(fullscreenMode(env({ display: 'standalone' }))).toBe('api');
  });

  it('iPhone trong Safari (không có Fullscreen API): hướng dẫn "Thêm vào MH chính"', () => {
    expect(fullscreenMode(env({ ios: true, apiSupported: false }))).toBe('guide');
  });

  it('đã mở từ biểu tượng trên màn hình chính: ẩn', () => {
    expect(fullscreenMode(env({ ios: true, apiSupported: false, iosStandalone: true, display: 'standalone' }))).toBe('hidden');
    expect(fullscreenMode(env({ ios: true, iosStandalone: true, display: 'standalone' }))).toBe('hidden');
    expect(fullscreenMode(env({ ios: true, apiSupported: false, display: 'fullscreen' }))).toBe('hidden');
    // Android: ứng dụng cài từ trình duyệt mở toàn màn hình.
    expect(fullscreenMode(env({ display: 'fullscreen' }))).toBe('hidden');
  });

  it('máy khác không có Fullscreen API: ẩn', () => {
    expect(fullscreenMode(env({ apiSupported: false }))).toBe('hidden');
    expect(fullscreenMode(env({ apiSupported: false, display: 'standalone' }))).toBe('hidden');
  });
});
