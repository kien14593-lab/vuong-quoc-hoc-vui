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
import { modelsInStoryOrder, TITLE_MODELS } from './game/needs';
import { startPlayTimer } from './game/playtime';
import { glbKeys, prefetchGlb, preloadGlb } from './models';
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
  // Chỉ chờ mô hình AI của màn hình tiêu đề; mỗi khu vực tự tải mô hình của mình khi chuyển cảnh (game/needs.ts).
  await preloadGlb(TITLE_MODELS, { timeoutMs: 20000, onProgress: (f) => bootProgress(0.55 + 0.3 * f) });
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
  // Tải dần ở nền mô hình của các khu vực sau (theo thứ tự trẻ sẽ gặp) để lúc vào khu vực không phải chờ.
  // Bộ đồ của bé (player_trai__…, player_gai__…) chỉ tải khi cần: mạng chậm không phải tải mọi bộ đồ.
  window.setTimeout(() => prefetchGlb([...modelsInStoryOrder(), ...glbKeys().filter((k) => !k.includes('__'))]), 1500);
}

void main().catch((e) => {
  console.error(e);
  const t = document.querySelector<HTMLElement>('.boot-text');
  if (t) t.textContent = 'Không khởi động được trò chơi. Hãy thử mở lại bằng trình duyệt Chrome hoặc Edge mới nhất.';
});
