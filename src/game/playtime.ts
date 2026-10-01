import { addPlayTime, hasProfile } from '../core/state';

const TICK = 10_000;
let lastActive = Date.now();

/** Đếm thời gian chơi thực tế (chỉ khi cửa sổ đang hiện và trẻ có thao tác trong 90 giây gần nhất). */
export function startPlayTimer(): void {
  const mark = () => (lastActive = Date.now());
  window.addEventListener('pointerdown', mark, { passive: true });
  window.addEventListener('pointermove', mark, { passive: true });
  window.addEventListener('keydown', mark, { passive: true });
  window.setInterval(() => {
    if (!hasProfile() || document.visibilityState !== 'visible') return;
    if (Date.now() - lastActive > 90_000) return;
    addPlayTime(TICK);
  }, TICK);
}
