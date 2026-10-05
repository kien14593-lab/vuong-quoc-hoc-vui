import { isTouchDevice } from '../core/device';
import { engine } from '../engine/core';
import { popBlock, pushBlock } from './root';

/** Thuần: điện thoại cầm dựng đứng (cạnh ngắn dưới 500 CSS px). Máy tính bảng dựng đứng vẫn chơi được. */
export function needsRotate(touch: boolean, w: number, h: number): boolean {
  return touch && h > w && w < 500;
}

/** Điện thoại cầm dựng đứng: phủ lời nhắc xoay ngang, tạm khóa điều khiển và dừng thời gian trò chơi; xoay ngang là chơi tiếp đúng chỗ cũ. */
export function installRotateHint(): void {
  if (!isTouchDevice()) return;
  let box: HTMLElement | null = null;
  let block = '';
  const sync = () => {
    const need = needsRotate(true, window.innerWidth, window.innerHeight);
    if (need && !box) {
      box = document.createElement('div');
      box.className = 'rotate-hint';
      box.setAttribute('role', 'alertdialog');
      const icon = document.createElement('div');
      icon.className = 'rotate-hint-icon';
      icon.textContent = '📱';
      const title = document.createElement('div');
      title.className = 'rotate-hint-title';
      title.textContent = 'Xoay ngang điện thoại để chơi nhé';
      const text = document.createElement('div');
      text.className = 'rotate-hint-text';
      text.textContent = 'Cầm máy nằm ngang thì chữ to hơn, dễ bấm hơn.';
      box.append(icon, title, text);
      document.body.appendChild(box);
      block = pushBlock('rotate');
      engine.hold('rotate', true);
    } else if (!need && box) {
      box.remove();
      box = null;
      popBlock(block);
      engine.hold('rotate', false);
    }
  };
  window.addEventListener('resize', sync);
  window.addEventListener('orientationchange', sync);
  sync();
}
