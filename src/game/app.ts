import { audio } from '../core/audio';
import { awardBadge, hasBadge, hasProfile, profile, saveNow, setPosition, unloadProfile, type ZoneId } from '../core/state';
import { engine } from '../engine/core';
import { runMini, type MiniResult } from '../minigames';
import { h, nextFrame, wait } from '../ui/dom';
import { hud } from '../ui/hud';
import { closeAllModals } from '../ui/modal';
import { clearBlocks, inputBlocked, layer } from '../ui/root';
import { openBag } from '../ui/screens/bag';
import { openMiniHub } from '../ui/screens/minihub';
import { openSettings } from '../ui/screens/settings';
import { hideTitleMenu, showTitleMenu } from '../ui/screens/title';
import { openWorldMap } from '../ui/screens/worldmap';
import { nav } from '../world/nav';
import { TitleStage } from '../world/title';
import type { Spawn, Zone } from '../world/zone';
import { createZone } from '../world/zones';
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
    veil = h('div.fade-veil', h('div.fade-veil-text'));
    layer('top').appendChild(veil);
  }
  return veil;
}

async function fade(on: boolean, text = ''): Promise<void> {
  const v = veilEl();
  if (on) (v.firstElementChild as HTMLElement).textContent = text;
  v.classList.toggle('on', on);
  await wait(on ? 380 : 40);
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
    await fade(true, `${meta.icon} ${meta.name}`);
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
function playMini(id: string): Promise<MiniResult | null> {
  return new Promise((resolve) => {
    const z = zone;
    if (!z) {
      resolve(null);
      return;
    }
    z.pause();
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
