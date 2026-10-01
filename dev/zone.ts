import '../src/styles/fonts';
import '../src/styles/main.css';
import '../src/styles/screens.css';
import '../src/styles/hud.css';
import '../src/styles/menus.css';
import { addCoins, addKeys, addStars, addTickets, addXp, createProfile, deleteProfile, listProfiles, loadProfile, markCollected, profile, saveNow, setFlag, setQuestState, type ZoneId } from '../src/core/state';
import { engine, type Quality } from '../src/engine/core';
import { loadFonts } from '../src/engine/text';
import { enterWorld, showTitle } from '../src/game/app';
import { installDebug } from '../src/game/debug';
import type { Grade } from '../src/math/types';
import { preloadGlb, setGlbEnabled } from '../src/models';
import { initUI } from '../src/ui/root';

/**
 * Bàn thử khu vực (dành cho phát triển).
 *  ?zone=forest            khu vực cần mở (mặc định village)
 *  ?spawn=from_village     điểm xuất hiện (mặc định start) – hoặc "x,z"
 *  ?grade=1..5             lớp của hồ sơ thử (mặc định 2)
 *  ?fresh=1                xóa hồ sơ thử cũ, bắt đầu lại từ đầu
 *  ?flags=intro.done,bear.start,quest.stars=done   bật cờ cốt truyện (k hoặc k=giá_trị)
 *  ?collect=village.star.1,village.star.2          đánh dấu vật phẩm đã nhặt
 *  ?stars=10&tickets=3&keys=1&xp=500&coins=300      cộng thêm tài nguyên
 *  ?quality=high|low       chất lượng đồ họa
 *  ?glb=0                  dùng mô hình dựng bằng code thay cho GLB
 *  ?title=1                mở màn hình tiêu đề thay vì vào thẳng khu vực
 * Trong bảng điều khiển: __vq.go('park'), __vq.flag('forest.bridge'), __vq.pos() ...
 */
const q = new URLSearchParams(location.search);
const grade = Math.max(1, Math.min(5, Number(q.get('grade') ?? 2))) as Grade;
const list = (k: string) =>
  (q.get(k) ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
const num = (k: string) => Number(q.get(k) ?? 0) || 0;

function ensureProfile(): void {
  const name = `Bé Khu Vực ${grade}`;
  const found = listProfiles().find((p) => p.name === name);
  if (found && q.get('fresh') === '1') deleteProfile(found.id);
  else if (found && loadProfile(found.id)) return;
  createProfile({ name, grade, look: { skin: 1, hair: 2, hairColor: 1, eyes: 0 }, equipped: {} });
}

function applyParams(): void {
  for (const f of list('flags')) {
    const [k, v] = f.split('=');
    if (k.startsWith('quest.')) setQuestState(k.slice(6), v ?? 'done');
    else setFlag(k, v === undefined ? true : v === 'false' ? false : Number.isFinite(Number(v)) ? Number(v) : v);
  }
  for (const c of list('collect')) markCollected(c);
  if (num('stars')) addStars(num('stars'));
  if (num('tickets')) addTickets(num('tickets'));
  if (num('keys')) addKeys(num('keys'));
  if (num('coins')) addCoins(num('coins'));
  if (num('xp')) addXp(num('xp'));
  saveNow();
}

async function main(): Promise<void> {
  ensureProfile();
  engine.init(document.getElementById('game')!, (q.get('quality') as Quality | null) ?? 'high');
  initUI();
  await loadFonts();
  if (q.get('glb') === '0') setGlbEnabled(false);
  else await preloadGlb();
  applyParams();
  installDebug();
  if (q.get('title') === '1') {
    showTitle();
    return;
  }
  const zone = (q.get('zone') ?? undefined) as ZoneId | undefined;
  const sp = q.get('spawn') ?? undefined;
  const xy = sp?.split(',').map(Number);
  const spawn = xy && xy.length === 2 && xy.every(Number.isFinite) ? { x: xy[0], z: xy[1] } : sp;
  await enterWorld({ zone: zone ?? profile().pos?.zone ?? 'village', spawn: spawn ?? 'start' });
}

void main();
