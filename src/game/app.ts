import { audio } from '../core/audio';
import { KIDS, kidKey } from '../core/outfits';
import { awardBadge, hasBadge, hasProfile, profile, saveNow, setPosition, takeRefundNotice, unloadProfile, type ZoneId } from '../core/state';
import { engine } from '../engine/core';
import { miniDef, miniTitle, runMini, type MiniResult } from '../minigames';
import { ensureGlb, glbReady, lowerGlb, prefetchGlb } from '../models';
import { h, nextFrame, wait } from '../ui/dom';
import { hud } from '../ui/hud';
import { coinIcon } from '../ui/icons';
import { closeAllModals } from '../ui/modal';
import { clearBlocks, inputBlocked, layer } from '../ui/root';
import { openBag } from '../ui/screens/bag';
import { openMiniHub } from '../ui/screens/minihub';
import { openSettings } from '../ui/screens/settings';
import { hideTitleMenu, showTitleMenu } from '../ui/screens/title';
import { openWorldMap } from '../ui/screens/worldmap';
import { toast } from '../ui/toast';
import { nav } from '../world/nav';
import { TitleStage } from '../world/title';
import type { Spawn, Zone } from '../world/zone';
import { createZone } from '../world/zones';
import { miniModels, playerModels, zoneModels, type PlayerNeed } from './needs';
import { checkBadges, zoneLock, ZONE_META } from './story';

/**
 * ĐIỀU PHỐI TRÒ CHƠI: màn hình tiêu đề ↔ thế giới (các khu vực) ↔ trò chơi nhỏ.
 */
let zone: Zone | null = null;
let moving = false;
let veil: HTMLElement | null = null;

export interface EnterOpts {
  zone?: ZoneId;
  /** Tên điểm xuất hiện trong khu vực, hoặc tọa độ. */
  spawn?: Spawn;
}

/** Khu vực đang chơi (nếu có). */
export function currentZone(): Zone | null {
  return zone;
}

function veilEl(): HTMLElement {
  if (!veil) {
    veil = h(
      'div.fade-veil',
      h('div.fade-veil-text'),
      h('div.fade-veil-load', h('div.boot-bar', h('div.boot-bar-fill')), h('div.boot-text', 'Đang chuẩn bị các bạn...')),
    );
    layer('top').appendChild(veil);
  }
  return veil;
}

async function fade(on: boolean, text = ''): Promise<void> {
  const v = veilEl();
  if (on) (v.firstElementChild as HTMLElement).textContent = text;
  else v.querySelector('.fade-veil-load')?.classList.remove('on');
  v.classList.toggle('on', on);
  await wait(on ? 380 : 40);
}

/**
 * Chờ tải mô hình AI cho cảnh sắp vào (trong lúc màn chuyển cảnh). Chờ lâu mới hiện thanh tiến độ;
 * quá hạn/lỗi thì nhân vật dùng tạm mô hình dựng bằng code (không bao giờ kẹt).
 * `first`: tải trước nhất – bé (luôn ở giữa màn hình): mạng chậm, quá hạn chờ thì ít nhất bé đã sẵn sàng.
 */
async function waitModels(keys: string[], first: string[] = [], ms = 15000): Promise<void> {
  if (glbReady(keys)) return;
  const load = veilEl().querySelector<HTMLElement>('.fade-veil-load')!;
  const fill = load.querySelector<HTMLElement>('.boot-bar-fill')!;
  fill.style.width = '0%';
  const hint = setTimeout(() => load.classList.add('on'), 800);
  await ensureGlb(keys, { timeoutMs: ms, first, onProgress: (f) => (fill.style.width = `${Math.round(f * 100)}%`) });
  clearTimeout(hint);
  load.classList.remove('on');
}

/** Bé của hồ sơ đang chơi (tải mô hình bé + bộ đồ trước khi vào cảnh có bé). */
function playerNeed(): PlayerNeed | null {
  if (!hasProfile()) return null;
  const p = profile();
  return { kid: p.kid, outfit: p.equipped.outfit };
}

/** Màn hình tiêu đề (cảnh làng 3D phía sau + menu). */
export function showTitle(): void {
  zone = null;
  hud.destroy();
  engine.setStage(new TitleStage());
  audio.music('title');
  showTitleMenu();
}

/** Đi sang khu vực khác (màn chuyển cảnh mờ dần). */
export async function goZone(id: ZoneId, spawn: Spawn = 'start'): Promise<void> {
  if (moving) return;
  moving = true;
  try {
    const meta = ZONE_META[id];
    // Tải mô hình AI của khu vực (và bé – trước nhất) song song với màn mờ dần. (Dựng lỗi thì về làng: mô hình AI của làng đã nạp từ màn tiêu đề.)
    // Tệp đang tải không cần gấp nữa (ảnh bé ở màn tiêu đề / tạo hồ sơ, ảnh thẻ cửa hàng...) nhường đường cho khu vực sắp vào.
    // Thú cưng không chờ: tải sau người trong khu vực rồi tự thay ngay tại chỗ (world/zone.ts makePet) – mạng chậm vẫn vào kịp.
    lowerGlb();
    const me = playerNeed();
    const models = waitModels(zoneModels(id, null, me), playerModels(me));
    await fade(true, `${meta.icon} ${meta.name}`);
    await models;
    closeAllModals();
    hud.setAction(null);
    await nextFrame();
    const old = zone;
    zone = null;
    if (old && engine.stage !== old) old.dispose();
    let z: Zone;
    try {
      z = createZone(id, spawn);
    } catch (e) {
      console.error(`[app] không dựng được khu vực "${id}"`, e);
      z = createZone('village', 'start');
    }
    engine.setStage(z);
    zone = z;
    setPosition(z.id, z.player.pos.x, z.player.pos.z);
    z.enter();
    await nextFrame();
    await fade(false);
  } finally {
    moving = false;
  }
}

/** Chơi một trò chơi nhỏ từ khu vực hiện tại rồi quay lại đúng chỗ cũ. */
async function playMini(id: string): Promise<MiniResult | null> {
  const z = zone;
  if (!z) return null;
  z.pause();
  const me = playerNeed();
  const keys = miniModels(id, me);
  const veiled = !glbReady(keys);
  if (veiled) {
    const info = miniDef(id)?.info;
    const models = waitModels(keys, playerModels(me));
    await fade(true, info ? miniTitle(info) : '');
    await models;
    if (zone !== z) {
      void fade(false);
      return null;
    }
  }
  return new Promise((resolve) => {
    const ok = runMini(
      id,
      (res) => {
        if (zone === z) {
          engine.setStage(z);
          z.enter();
        }
        if (res && id === 'shoot_answer' && res.stars >= 3 && !hasBadge('cong-sieu-toc')) awardBadge('cong-sieu-toc');
        checkBadges();
        resolve(res);
      },
      { keepPrev: true },
    );
    if (!ok) {
      z.enter();
      resolve(null);
    }
    if (veiled) void fade(false);
  });
}

/** Mở menu khi đang đi trong thế giới (không mở khi đang hội thoại / chuyển cảnh). */
function menuOk(): boolean {
  return !!zone && !zone.busy && !zone.paused && !zone.leaving && !moving && !inputBlocked();
}

function bindHud(): void {
  hud.bind({
    map: () => {
      if (menuOk() && zone) openWorldMap(zone.id, (to) => void goZone(to, 'start'));
    },
    bag: () => {
      if (menuOk()) openBag();
    },
    minis: () => {
      if (menuOk()) openMiniHub((id) => void zone?.playMini(id));
    },
    settings: () => {
      if (menuOk()) openSettings({ inGame: true });
    },
    rotate: (deg) => zone?.cam.rotate(deg),
    jump: () => {
      if (zone && !zone.busy) zone.player.jump();
    },
  });
}

nav.go = (to, spawn) => void goZone(to, spawn ?? 'start');
nav.mini = (id) => playMini(id);

/** Vào thế giới với hồ sơ đang chọn. */
export async function enterWorld(o: EnterOpts = {}): Promise<void> {
  if (!hasProfile()) return;
  closeAllModals();
  clearBlocks();
  hideTitleMenu();
  const p = profile();
  let id: ZoneId = o.zone ?? p.pos?.zone ?? 'village';
  let spawn: Spawn = o.spawn ?? 'start';
  if (!o.zone && p.pos) spawn = { x: p.pos.x, z: p.pos.y };
  if (!p.flags['intro.done']) {
    id = 'village';
    spawn = 'start';
  }
  if (zoneLock(id)) {
    id = 'village';
    spawn = 'start';
  }
  bindHud();
  await goZone(id, spawn);
  checkBadges();
  // Hồ sơ cũ: báo số xu trả lại cho áo, quần, giày đã bỏ.
  const refund = hasProfile() ? takeRefundNotice() : 0;
  if (refund > 0) toast(`Áo, quần, giày cũ đã được đổi thành ${refund} xu. Ghé cửa hàng xem Bộ đồ mới nhé!`, { icon: coinIcon(), tone: 'good', ms: 7000 });
  // Tải sẵn (ở nền) bé kia mặc đồ thường ngày để đổi bé trai ↔ bé gái trong Túi đồ không phải chờ.
  if (hasProfile()) prefetchGlb(KIDS.filter((k) => k !== profile().kid).map(kidKey));
}

/** Thoát về màn hình tiêu đề (lưu hồ sơ). */
export function backToTitle(): void {
  if (zone && hasProfile()) setPosition(zone.id, zone.player.pos.x, zone.player.pos.z);
  if (hasProfile()) saveNow();
  closeAllModals();
  clearBlocks();
  unloadProfile();
  showTitle();
}
