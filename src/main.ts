import './styles/fonts';
import './styles/main.css';
import './styles/screens.css';
import './styles/hud.css';
import './styles/menus.css';
import { getSettings } from './core/state';
import { engine } from './engine/core';
import { loadFonts } from './engine/text';
import { showTitle } from './game/app';
import { installDebug } from './game/debug';
import { startPlayTimer } from './game/playtime';
import { preloadGlb } from './models';
import { initUI } from './ui/root';

/** Thanh tiến độ trên màn hình khởi động. */
function bootProgress(pct: number, text?: string): void {
  const fill = document.querySelector<HTMLElement>('.boot-bar-fill');
  if (fill) fill.style.width = `${Math.round(pct * 100)}%`;
  const t = document.querySelector<HTMLElement>('.boot-text');
  if (t && text) t.textContent = text;
}

async function main(): Promise<void> {
  bootProgress(0.1);
  engine.init(document.getElementById('game')!, getSettings().quality);
  initUI();
  bootProgress(0.3, 'Đang tải phông chữ...');
  await loadFonts();
  bootProgress(0.55, 'Đang chuẩn bị các bạn thú...');
  await preloadGlb();
  bootProgress(0.85, 'Sắp xong rồi...');
  showTitle();
  startPlayTimer();
  installDebug();
  bootProgress(1);
  const boot = document.getElementById('boot-screen');
  if (boot) {
    boot.classList.add('hide');
    window.setTimeout(() => boot.remove(), 700);
  }
}

void main().catch((e) => {
  console.error(e);
  const t = document.querySelector<HTMLElement>('.boot-text');
  if (t) t.textContent = 'Không khởi động được trò chơi. Hãy thử mở lại bằng trình duyệt Chrome hoặc Edge mới nhất.';
});
