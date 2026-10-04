import { flushSave } from '../core/state';
import { engine } from '../engine/core';

/**
 * Máy thiếu bộ nhớ (hay gặp trên iPhone / iPad) có thể làm hình 3D bị dừng. Thường hình tự có lại sau giây lát;
 * nếu không, hiện lời nhắn thân thiện và nút "Tải lại" (tiến trình đã được lưu trong máy).
 */
export function installContextLossGuard(): void {
  let timer = 0;
  let box: HTMLElement | null = null;
  const show = () => {
    if (box) return;
    box = document.createElement('div');
    box.className = 'gl-lost';
    box.setAttribute('role', 'alertdialog');
    const card = document.createElement('div');
    card.className = 'gl-lost-card';
    const icon = document.createElement('div');
    icon.className = 'gl-lost-icon';
    icon.textContent = '😴';
    const title = document.createElement('div');
    title.className = 'gl-lost-title';
    title.textContent = 'Hình 3D đang nghỉ một chút';
    const text = document.createElement('div');
    text.className = 'gl-lost-text';
    text.textContent = 'Máy hơi thiếu bộ nhớ nên hình bị tạm dừng. Bấm “Tải lại” để chơi tiếp nhé — mọi tiến trình đã được lưu.';
    const btn = document.createElement('button');
    btn.className = 'gl-lost-btn';
    btn.type = 'button';
    btn.textContent = '🔄 Tải lại';
    btn.addEventListener('click', () => location.reload());
    card.append(icon, title, text, btn);
    box.appendChild(card);
    document.body.appendChild(box);
  };
  engine.onContextChange((lost) => {
    clearTimeout(timer);
    if (lost) {
      flushSave();
      timer = window.setTimeout(show, 2500);
    } else {
      box?.remove();
      box = null;
    }
  });
}
