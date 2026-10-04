import { engine } from '../engine/core';

const QUALITY_NAME = { high: 'Đẹp', medium: 'Vừa', low: 'Nhẹ' } as const;

/**
 * Bảng số đo nhỏ ở mép trên màn hình – chỉ hiện khi mở trò chơi với `?fps=1` ở cuối địa chỉ,
 * để đọc được số đo ngay trên iPhone / iPad (máy không có công cụ cho nhà phát triển).
 */
export function installFpsMeter(): void {
  if (new URLSearchParams(location.search).get('fps') !== '1') return;
  const el = document.createElement('div');
  el.className = 'fps-meter';
  el.setAttribute('aria-hidden', 'true');
  document.body.appendChild(el);
  const tick = () => {
    const s = engine.stats();
    el.textContent =
      `${Math.round(s.fps)} hình/giây · 90%: ${s.p90.toFixed(1)} ms\n` +
      `${s.width}×${s.height} · tỉ lệ ${s.ratio.toFixed(2)} · ${QUALITY_NAME[s.quality]}${s.auto ? ' (tự động)' : ''}\n` +
      `${s.calls} lần vẽ · ${Math.round(s.tris / 1000)}k tam giác${s.touch ? ' · cảm ứng' : ''}`;
  };
  tick();
  window.setInterval(tick, 500);
}
