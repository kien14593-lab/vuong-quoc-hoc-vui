import '../src/styles/fonts';
import '../src/styles/main.css';
import '../src/styles/screens.css';
import { createProfile, listProfiles, loadProfile, setKid } from '../src/core/state';
import type { Kid } from '../src/core/outfits';
import { engine, type Quality } from '../src/engine/core';
import { loadFonts } from '../src/engine/text';
import type { Grade } from '../src/math/types';
import { preloadGlb, setGlbEnabled } from '../src/models';
import { currentMini, miniList, runMini } from '../src/minigames';
import { h } from '../src/ui/dom';
import { initUI, layer } from '../src/ui/root';

/**
 * Bàn thử trò chơi nhỏ (dành cho phát triển).
 *  ?game=fishing        mở thẳng trò chơi (không có = sảnh chọn trò)
 *  ?grade=1..5          lớp của hồ sơ thử (mặc định 2)
 *  ?kid=trai|gai        bé trai / bé gái của hồ sơ thử (mặc định bé trai)
 *  ?quality=high|low    chất lượng đồ họa
 *  ?auto=start          bỏ qua màn hướng dẫn
 *  ?auto=solve          bỏ qua hướng dẫn + tự trả lời đúng mỗi vòng (kiểm thử luồng chơi)
 *  ?glb=0               dùng mô hình dựng bằng code thay cho mô hình GLB
 * Trong bảng điều khiển: __mini.solve(), __mini.wrong(), __mini.start(), __mini.game()
 */
const q = new URLSearchParams(location.search);
const grade = Math.max(1, Math.min(5, Number(q.get('grade') ?? 2))) as Grade;
const auto = q.get('auto') ?? '';
const kid: Kid = q.get('kid') === 'gai' ? 'gai' : 'trai';

function ensureProfile(): void {
  const name = `Bé Thử Lớp ${grade}`;
  const found = listProfiles().find((p) => p.name === name);
  if (found && loadProfile(found.id)) {
    if (q.has('kid')) setKid(kid);
    return;
  }
  createProfile({ name, grade, kid });
}

function start(id: string): void {
  hub.remove();
  runMini(id, (result) => {
    console.log('[mini] kết thúc', result);
    showHub();
  });
  if (auto) {
    const tryStart = () => {
      const b = document.querySelector<HTMLButtonElement>('.mg-btn-go');
      if (b) b.click();
      else window.setTimeout(tryStart, 100);
    };
    window.setTimeout(tryStart, 300);
  }
}

const hub = h(
  'div.dev-hub',
  { style: { position: 'absolute', inset: '0', display: 'flex', flexWrap: 'wrap', gap: '24px', alignContent: 'center', justifyContent: 'center', padding: '60px', background: 'linear-gradient(#bfe6ff,#e8f8dc)' } as Partial<CSSStyleDeclaration> },
);

function showHub(): void {
  hub.replaceChildren(
    ...miniList().map((d) => {
      const b = h('button.btn', { style: { fontSize: '34px', minWidth: '420px', justifyContent: 'flex-start' } as Partial<CSSStyleDeclaration> }, `${d.info.icon} ${d.info.name}`, h('small', { style: { opacity: '0.6', fontSize: '22px' } as Partial<CSSStyleDeclaration> }, `· ${d.info.skill} · cấp ${d.info.unlock}`));
      b.addEventListener('click', () => start(d.info.id));
      return b;
    }),
  );
  layer('panel').appendChild(hub);
}

async function main(): Promise<void> {
  ensureProfile();
  engine.init(document.getElementById('game')!, (q.get('quality') as Quality | null) ?? 'high');
  initUI();
  await loadFonts();
  if (q.get('glb') === '0') setGlbEnabled(false);
  else await preloadGlb();
  const id = q.get('game');
  if (id) start(id);
  else showHub();

  if (auto === 'solve') {
    window.setInterval(() => {
      const g = currentMini();
      const r = g?.current;
      if (r && !r.solved) r.submit(r.q.answer);
    }, 1500);
  }
}

const api = {
  game: () => currentMini(),
  solve(): boolean {
    const r = currentMini()?.current;
    if (!r || r.solved) return false;
    r.submit(r.q.answer);
    return true;
  },
  wrong(): boolean {
    const r = currentMini()?.current;
    if (!r || r.solved) return false;
    const bad = r.q.choices.find((c) => !(r.q.accept?.length ? r.q.accept.includes(c.value) : c.value === r.q.answer));
    r.submit(bad?.value ?? '__sai__');
    return true;
  },
  start(): void {
    document.querySelector<HTMLButtonElement>('.mg-btn-go')?.click();
  },
  list: () => miniList().map((d) => d.info.id),
};
(window as unknown as { __mini: typeof api }).__mini = api;

void main();
