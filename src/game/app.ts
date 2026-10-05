import { audio } from '../core/audio';
import { bus } from '../core/events';
import { KIDS, kidKey } from '../core/outfits';
import { awardBadge, hasBadge, hasProfile, profile, saveNow, setPosition, takeRefundNotice, unloadProfile, type ZoneId } from '../core/state';
import { engine, warmUp } from '../engine/core';
import { miniDef, miniTitle, runMini, type MiniResult } from '../minigames';
import { ensureGlb, glbReady, lowerGlb, prefetchGlb } from '../models';
import { h, nextFrame, wait } from '../ui/dom';
import { prepareSpeakers } from '../ui/dialog';
import { hud } from '../ui/hud';
import { coinIcon } from '../ui/icons';
import { closeAllModals } from '../ui/modal';
import { drawPrepared, fitPrepared } from '../ui/portrait';
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
import { miniModels, playerModels, zoneLateModels, zoneModels, type PlayerNeed } from './needs';
import { checkBadges, zoneLock, ZONE_META } from './story';
import { ensureEnglish } from './subject';

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
  // Sau màn che máy đang tải / dựng cảnh: khung hình chậm lúc này không tính khi tự chỉnh độ nét.
  engine.setLoading(on);
  await wait(on ? 380 : 40);
}

/** Màn che mờ dần trong chừng này ms (styles/hud.css: .fade-veil transition). */
const VEIL_FADE_MS = 350;

/**
 * Chờ tối đa (ms) mô hình AI của khu vực sắp vào. Quá hạn (mạng chậm) thì vẫn vào: nhân vật chưa tải kịp tạm dùng mô hình
 * dựng bằng code, tải xong tự thay ngay tại chỗ (world/zone.ts loadLate). Trò chơi nhỏ vẫn chờ đủ 15 giây.
 */
const ZONE_WAIT_MS = 7000;

/**
 * Bé chưa tải kịp lúc hết ZONE_WAIT_MS (mạng chậm; bé tải cùng lúc với tệp khu vực đang tải dở từ màn hình tiêu đề – thường
 * chỉ thiếu chút nữa): chờ riêng bé thêm tối đa (ms). Bé luôn ở giữa màn hình – đổi mô hình bé ngay lúc vào dễ thấy nhất.
 */
const KID_GRACE_MS = 1500;

/**
 * Chờ tải mô hình AI cho cảnh sắp vào (trong lúc màn chuyển cảnh). Chờ lâu mới hiện thanh tiến độ;
 * quá hạn/lỗi thì nhân vật dùng tạm mô hình dựng bằng code (không bao giờ kẹt).
 * `first`: tải trước nhất – bé (luôn ở giữa màn hình): mạng chậm, quá hạn chờ thì ít nhất bé đã sẵn sàng.
 * `grace`: quá hạn mà bé (trong `keys`) vẫn chưa xong thì chờ riêng bé thêm tối đa (ms).
 */
async function waitModels(keys: string[], first: string[] = [], ms = 15000, grace = 0): Promise<void> {
  if (glbReady(keys)) return;
  const load = veilEl().querySelector<HTMLElement>('.fade-veil-load')!;
  const fill = load.querySelector<HTMLElement>('.boot-bar-fill')!;
  fill.style.width = '0%';
  const hint = setTimeout(() => load.classList.add('on'), 800);
  await ensureGlb(keys, { timeoutMs: ms, first, quiet: true, onProgress: (f) => (fill.style.width = `${Math.round(f * 100)}%`) });
  const kid = first.filter((k) => keys.includes(k));
  if (grace && kid.length && !glbReady(kid)) await ensureGlb(kid, { timeoutMs: grace, quiet: true });
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
  // Cảnh đang rời (khu vực – cả lúc đi bằng bản đồ, không chỉ qua cổng – hoặc màn hình tiêu đề) thôi bắt đầu tải tệp
  // tải sau (world/late.ts), nhường đường cho khu vực sắp vào.
  const from = zone ?? (engine.stage instanceof TitleStage ? engine.stage : null);
  if (from) from.leaving = true;
  try {
    const meta = ZONE_META[id];
    const me = playerNeed();
    // Tải mô hình AI của khu vực (và bé – trước nhất) song song với màn mờ dần; chờ tối đa ZONE_WAIT_MS, phần chưa kịp
    // thay tại chỗ sau khi vào. (Dựng lỗi thì về làng: mô hình AI của làng đã nạp từ màn tiêu đề.)
    // Tệp đang tải không cần gấp nữa (ảnh bé ở màn tiêu đề / tạo hồ sơ, ảnh thẻ cửa hàng...) nhường đường cho khu vực sắp vào –
    // trừ tệp khu vực ấy cũng cần (nhân vật phải chờ, thú cưng, mô hình tải sau – vd. Chú Gấu, dân làng đang tải ở màn hình
    // tiêu đề): tải tiếp, không bỏ phần đã tải rồi tải lại từ đầu.
    // Thú cưng không chờ: tải sau người trong khu vực rồi tự thay ngay tại chỗ (world/zone.ts makePet) – mạng chậm vẫn vào kịp.
    const pet = hasProfile() ? profile().equipped.pet : null;
    const need = zoneModels(id, null, me);
    lowerGlb([...need, ...zoneLateModels(id), ...(pet ? [pet] : [])]);
    const models = waitModels(need, playerModels(me), ZONE_WAIT_MS, KID_GRACE_MS);
    // Bộ câu hỏi Tiếng Anh (tải một lần, khi hồ sơ học Tiếng Anh / Cả hai) – biển báo, lời thoại dựng theo môn.
    const lessons = ensureEnglish();
    await fade(true, `${meta.icon} ${meta.name}`);
    await models;
    // Thú cưng tải ngay sau phần phải chờ, không đợi dựng xong khu vực (makePet): mạng không nghỉ – khe hở thì tệp nạp nền
    // chen vào rồi bị hủy.
    if (pet && !glbReady([pet])) void ensureGlb([pet]);
    await lessons;
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
    // Sau màn che (khu vực đứng yên tới lúc mở màn): biên dịch trước shader + đưa ảnh lên GPU cho cả khu vực,
    // kể cả phần chưa nhìn thấy – bé bắt đầu đi, quay camera không bị khựng.
    z.pause();
    const warm = warmUp(z.scene);
    // Chân dung người trong khu vực (Chú Gấu đi cùng, rồi gần bé trước): shader biên dịch cùng lúc với khu vực (không chờ
    // thêm), mở màn rồi vẽ dần lúc bé đứng yên, không xoay / phóng camera – hộp thoại đầu tiên hiện ngay, không khựng.
    // Người đổi sang mô hình AI sau khi mở màn: world/zone.ts lateLoaded.
    prepareSpeakers(z.talkers());
    await warm;
    if (zone === z) {
      z.enter();
      // Chân dung bé trên HUD vừa vẽ (khác cỡ) → đổi lại cỡ khung vẽ cho ảnh vẽ sẵn đầu tiên lúc còn che màn.
      fitPrepared();
    }
    await nextFrame();
    await fade(false);
    // Vẽ chân dung sau khi màn che đã mờ hẳn (lúc cảnh vừa hiện, GPU còn bận – vẽ lúc ấy là khựng ngay giữa lúc cảnh hiện ra).
    if (zone === z)
      drawPrepared(() => {
        if (zone !== z || z.leaving) return 'stop';
        const p = z.player;
        return z.paused || p.moving || p.vel.lengthSq() > 0.01 || z.cam.busy ? 'wait' : 'go';
      }, VEIL_FADE_MS);
  } finally {
    // Không đổi được cảnh (lỗi giữa chừng): cảnh cũ vẫn đang chạy, tải tiếp như thường.
    if (from && engine.stage === from) from.leaving = false;
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
        if (res && id === 'shoot_answer' && res.stars >= 3) {
          const badge = res.subject === 'english' ? 'tu-vung-sieu-toc' : 'cong-sieu-toc';
          if (!hasBadge(badge)) awardBadge(badge);
        }
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
nav.title = () => backToTitle();

/**
 * Đổi môn / Unit khi đang chơi (Cài đặt, bảng giáo viên): dựng lại khu vực tại chỗ khi đã đóng hết bảng,
 * để biển báo, mục tiêu và câu hỏi theo môn mới.
 */
let subjectDirty = false;
bus.on('subject', () => {
  if (!zone || subjectDirty) return;
  subjectDirty = true;
  void (async () => {
    while (zone && !menuOk()) await wait(300);
    subjectDirty = false;
    const z = zone;
    if (z) await goZone(z.id, { x: z.player.pos.x, z: z.player.pos.z });
  })();
});

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
