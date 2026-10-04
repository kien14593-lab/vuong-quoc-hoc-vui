import { item, PLANTS, type ItemCat } from '../core/items';
import { outfitFits, playerKey, type Kid } from '../core/outfits';
import { hasProfile, profile, type Equipped } from '../core/state';
import { ensureGlb, glbReady } from '../models/glb';
import { h } from './dom';
import { modelPortrait, playerPortrait, setModelPortrait, type Framing } from './portrait';

/**
 * Ảnh minh họa vật phẩm (dựng từ mô hình 3D): bộ đồ, mũ, balo, phụ kiện hiện trên chính bé của người chơi,
 * thú cưng / đồ trang trí / hạt giống hiện mô hình riêng.
 */
export const CAT_EMOJI: Record<ItemCat, string> = {
  outfit: '👕',
  hat: '🧢',
  backpack: '🎒',
  acc: '🎀',
  pet: '🐶',
  board: '🛹',
  decor: '🛋️',
  seed: '🌱',
  quest: '🎁',
};

const WEAR: Partial<Record<ItemCat, { framing: Framing; yaw: number; zoom?: number }>> = {
  outfit: { framing: 'full', yaw: 18 },
  hat: { framing: 'head', yaw: 22 },
  backpack: { framing: 'bust', yaw: 160 },
  acc: { framing: 'bust', yaw: 24 },
};

/** Bé + đồ để vẽ ảnh một món đeo trên người (null: không phải đồ mặc/đeo hoặc chưa chọn hồ sơ). */
function wearLook(id: string): { kid: Kid; eq: Equipped } | null {
  const d = item(id);
  if (!d || !WEAR[d.cat] || !hasProfile()) return null;
  const p = profile();
  const eq: Equipped = { ...p.equipped, pet: null, board: null, [d.cat]: id };
  let kid = p.kid;
  if (d.cat === 'outfit') {
    // Bộ đồ hiện riêng (không mũ, balo); bộ đồ chỉ có cho bé kia thì vẽ trên bé kia.
    eq.hat = eq.backpack = eq.acc = null;
    if (!outfitFits(kid, id)) kid = (Object.keys(d.models ?? {})[0] as Kid | undefined) ?? kid;
  } else if (d.cat !== 'hat') eq.hat = d.cat === 'acc' ? p.equipped.hat : null;
  return { kid, eq };
}

/** Ảnh (data URL) của vật phẩm; '' nếu không dựng được (hoặc mô hình bé/bộ đồ chưa tải xong). */
export function itemArt(id: string, size = 220): string {
  const d = item(id);
  if (!d) return '';
  const w = WEAR[d.cat];
  if (w) {
    const look = wearLook(id);
    return look ? playerPortrait(look.kid, look.eq, { framing: w.framing, yaw: w.yaw, size, zoom: w.zoom }) : '';
  }
  switch (d.cat) {
    case 'pet':
      return modelPortrait(id, { framing: 'full', yaw: 28, size, pitch: 12 });
    case 'board':
      return modelPortrait(id, { framing: 'full', yaw: 35, size, pitch: 40, opts: d.color ? { color: d.color } : {} });
    case 'decor':
      return modelPortrait(`decor_${d.style}`, { framing: 'full', yaw: 20, size, pitch: 18 });
    case 'seed': {
      const st = d.style ?? 'sunflower';
      return modelPortrait(`plant_${st}`, { framing: 'full', yaw: 15, size, pitch: 22, opts: { stage: PLANTS[st]?.stages ?? 3 } });
    }
    case 'quest':
      return modelPortrait(`pickup_${id}`, { framing: 'full', yaw: 20, size, pitch: 15 });
    default:
      return '';
  }
}

/* Dựng ảnh dần dần (vài ảnh mỗi khung hình) để bảng mở ra ngay, không bị khựng. */
const queue: (() => void)[] = [];
let pumping = false;

function pump(): void {
  if (pumping) return;
  pumping = true;
  const step = () => {
    const t0 = performance.now();
    while (queue.length && performance.now() - t0 < 14) queue.shift()!();
    if (queue.length) requestAnimationFrame(step);
    else pumping = false;
  };
  requestAnimationFrame(step);
}

/**
 * Mô hình bộ đồ chưa tải: tải lần lượt TỪNG tệp (mạng chậm không phải tải mọi bộ đồ cùng lúc), chỉ cho ảnh còn
 * đang hiện trên màn hình (đóng cửa hàng / đổi ngăn thì bỏ qua phần còn lại).
 */
let modelChain: Promise<unknown> = Promise.resolve();

function whenModel(key: string, box: HTMLElement, then: () => void): void {
  if (glbReady([key])) return then();
  modelChain = modelChain.then(async () => {
    if (!box.isConnected) return;
    await ensureGlb([key]);
    if (box.isConnected) then();
  });
}

/** Thẻ ảnh vật phẩm (có biểu tượng tạm trong lúc dựng ảnh). */
export function itemThumb(id: string, cls = 'item-art', size = 220): HTMLElement {
  const d = item(id);
  if (d?.cat === 'pet') return petThumb(id, cls, size);
  const box = h(`div.${cls}`, h('span.item-art-emoji', d ? (d.icon ?? CAT_EMOJI[d.cat]) : '❔'));
  const draw = () => {
    queue.push(() => {
      if (!box.isConnected) return;
      const url = itemArt(id, size);
      if (!url) return;
      box.replaceChildren(h('img', { src: url, alt: '', draggable: false }));
    });
    pump();
  };
  const look = wearLook(id);
  if (look) whenModel(playerKey(look.kid, look.eq.outfit), box, draw);
  else draw();
  return box;
}

/** Ảnh mô hình bất kỳ, dựng dần như `itemThumb`. */
export function lazyModelThumb(make: () => string, emoji: string, cls = 'item-art'): HTMLElement {
  const box = h(`div.${cls}`, h('span.item-art-emoji', emoji));
  queue.push(() => {
    if (!box.isConnected) return;
    const url = make();
    if (url) box.replaceChildren(h('img', { src: url, alt: '', draggable: false }));
  });
  pump();
  return box;
}

/**
 * Mô hình AI của thú cưng chưa tải: tải lần lượt TỪNG con (mạng chậm không phải tải mọi con cùng lúc), chỉ cho thẻ còn
 * đang hiện trên màn hình (đóng cửa hàng / đổi ngăn thì bỏ qua phần còn lại).
 */
let petChain: Promise<unknown> = Promise.resolve();

function petLoad(key: string, box: HTMLElement): Promise<unknown> {
  petChain = petChain.then(() => (box.isConnected && !glbReady([key]) ? ensureGlb([key]) : false));
  return petChain;
}

/** Thẻ ảnh thú cưng: hiện ngay (tạm bằng thú dựng bằng code, nhấp nháy nhẹ), tải xong mô hình AI thì tự thay. */
function petThumb(id: string, cls: string, size: number): HTMLElement {
  const box = h(`div.${cls}`, h('span.item-art-emoji', CAT_EMOJI.pet));
  queue.push(() => {
    if (!box.isConnected) return;
    const img = h<HTMLImageElement>('img', { alt: '', draggable: false });
    if (setModelPortrait(img, id, { framing: 'full', yaw: 28, size, pitch: 12 }, (k) => petLoad(k, box))) box.replaceChildren(img);
  });
  pump();
  return box;
}
