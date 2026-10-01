import { item, PLANTS, type ItemCat } from '../core/items';
import { hasProfile, profile, type Equipped } from '../core/state';
import { h } from './dom';
import { modelPortrait, playerPortrait, type Framing } from './portrait';

/**
 * Ảnh minh họa vật phẩm (dựng từ mô hình 3D): quần áo hiện trên chính nhân vật của bé,
 * thú cưng / đồ trang trí / hạt giống hiện mô hình riêng.
 */
export const CAT_EMOJI: Record<ItemCat, string> = {
  shirt: '👕',
  pants: '👖',
  shoes: '👟',
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
  shirt: { framing: 'bust', yaw: 18 },
  pants: { framing: 'full', yaw: 18 },
  shoes: { framing: 'full', yaw: 30 },
  hat: { framing: 'head', yaw: 22 },
  backpack: { framing: 'bust', yaw: 160 },
  acc: { framing: 'bust', yaw: 24 },
};

/** Ảnh (data URL) của vật phẩm; '' nếu không dựng được. */
export function itemArt(id: string, size = 220): string {
  const d = item(id);
  if (!d) return '';
  const w = WEAR[d.cat];
  if (w) {
    if (!hasProfile()) return '';
    const p = profile();
    const eq: Equipped = { ...p.equipped, pet: null, board: null, [d.cat]: id };
    if (d.cat !== 'hat') eq.hat = d.cat === 'acc' ? p.equipped.hat : null;
    return playerPortrait(p.look, eq, { framing: w.framing, yaw: w.yaw, size, zoom: w.zoom });
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

/** Thẻ ảnh vật phẩm (có biểu tượng tạm trong lúc dựng ảnh). */
export function itemThumb(id: string, cls = 'item-art', size = 220): HTMLElement {
  const d = item(id);
  const box = h(`div.${cls}`, h('span.item-art-emoji', d ? CAT_EMOJI[d.cat] : '❔'));
  queue.push(() => {
    if (!box.isConnected) return;
    const url = itemArt(id, size);
    if (!url) return;
    box.replaceChildren(h('img', { src: url, alt: '', draggable: false }));
  });
  pump();
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
