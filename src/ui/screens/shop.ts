import { sfx } from '../../core/audio';
import { bus } from '../../core/events';
import { CAT_NAMES, item, ITEMS, type ItemCat, type ItemDef } from '../../core/items';
import { DEFAULT_OUTFIT, kidOutfits } from '../../core/outfits';
import { awardBadge, equip, giveItem, hasBadge, hasItem, itemCount, level, profile, spendCoins } from '../../core/state';
import { setPlayerPortrait } from '../portrait';
import { button, h } from '../dom';
import { coinIcon } from '../icons';
import { itemThumb } from '../itemArt';
import { openModal } from '../modal';
import { toast } from '../toast';

/** Các ngăn trong cửa hàng (theo thứ tự hiển thị). */
const SHOP_TABS: { cats: ItemCat[]; label: string; icon: string }[] = [
  { cats: ['outfit'], label: 'Bộ đồ', icon: '👕' },
  { cats: ['hat', 'acc'], label: 'Mũ & phụ kiện', icon: '🧢' },
  { cats: ['backpack'], label: 'Balo', icon: '🎒' },
  { cats: ['pet', 'board'], label: 'Thú cưng', icon: '🐶' },
  { cats: ['decor'], label: 'Trang trí nhà', icon: '🛋️' },
  { cats: ['seed'], label: 'Hạt giống', icon: '🌱' },
];

const WEARABLE: ItemCat[] = ['outfit', 'hat', 'backpack', 'acc', 'pet', 'board'];
/** Mặc thử được trên bé (ảnh bên trái). */
const TRY_ON: ItemCat[] = ['outfit', 'hat', 'backpack', 'acc'];

/** Số lượng mua được nhiều lần (hạt giống); còn lại mỗi món chỉ mua một lần. */
function stackable(d: ItemDef): boolean {
  return d.cat === 'seed';
}

/** Món bày bán trong một ngăn: bộ đồ chỉ gồm bộ có cho bé đang chơi (kể cả bộ miễn phí, trừ đồ thường ngày). */
function shopList(cats: ItemCat[]): ItemDef[] {
  const kid = profile().kid;
  const pool = cats.includes('outfit') ? [...kidOutfits(kid), ...ITEMS.filter((d) => d.cat !== 'outfit' && cats.includes(d.cat))] : ITEMS.filter((d) => cats.includes(d.cat));
  return pool.filter((d) => !d.hidden && (d.cat === 'outfit' ? d.id !== DEFAULT_OUTFIT : d.price > 0)).sort((a, b) => a.level - b.level || a.price - b.price);
}

/** Cửa hàng của Cô Mèo. Trả về khi đóng cửa hàng. */
export function openShop(startTab = 0): Promise<void> {
  let tab = Math.max(0, Math.min(SHOP_TABS.length - 1, startTab));
  const tabsEl = h('div.menu-tabs');
  const grid = h('div.shop-grid');
  const coinsEl = h('span.shop-coins-n');
  const preview = h<HTMLImageElement>('img.shop-preview', { alt: '', draggable: false });
  const previewName = h('div.shop-preview-name');
  let tryOn: ItemDef | null = null;

  const refreshWallet = () => {
    coinsEl.textContent = String(profile().coins);
  };
  const refreshPreview = () => {
    const p = profile();
    const eq = { ...p.equipped };
    if (tryOn && TRY_ON.includes(tryOn.cat)) (eq as unknown as Record<string, string | null>)[tryOn.cat] = tryOn.id;
    setPlayerPortrait(preview, p.kid, eq, { framing: 'full', size: 420, yaw: tryOn?.cat === 'backpack' ? 160 : 18 });
    previewName.textContent = tryOn ? `Thử: ${tryOn.name}` : p.name;
  };

  const buy = (d: ItemDef) => {
    const p = profile();
    if (level() < d.level) {
      sfx('error');
      toast(`Món này mở khi bạn đạt cấp ${d.level}. Cố lên nhé!`, { icon: '🔒', tone: 'warn' });
      return;
    }
    if (!stackable(d) && hasItem(d.id)) return;
    if (p.coins < d.price) {
      sfx('error');
      toast(`Bạn cần thêm ${d.price - p.coins} xu nữa. Hãy giải toán hoặc chơi mini-game để có thêm xu nhé!`, { icon: coinIcon(), tone: 'warn', ms: 3600 });
      return;
    }
    if (!spendCoins(d.price)) return;
    giveItem(d.id, 1);
    sfx('buy');
    toast(`Bạn đã mua ${d.name}!`, { icon: '🛍️', tone: 'good' });
    if (!hasBadge('nguoi-mua-sam')) awardBadge('nguoi-mua-sam');
    if (WEARABLE.includes(d.cat)) {
      equip(d.cat as Parameters<typeof equip>[0], d.id);
      tryOn = null;
    }
    refreshWallet();
    refreshPreview();
    render();
  };

  const card = (d: ItemDef): HTMLElement => {
    const owned = hasItem(d.id);
    const n = itemCount(d.id);
    const locked = level() < d.level;
    const soldOut = owned && !stackable(d);
    const affordable = profile().coins >= d.price;
    const el = h(
      `div.shop-card${locked ? '.locked' : ''}${soldOut ? '.owned' : ''}`,
      {
        onclick: () => {
          if (TRY_ON.includes(d.cat)) {
            tryOn = tryOn?.id === d.id ? null : d;
            sfx('pop');
            refreshPreview();
            grid.querySelectorAll('.shop-card.trying').forEach((c) => c.classList.remove('trying'));
            if (tryOn) el.classList.add('trying');
          }
        },
      },
      itemThumb(d.id, 'item-art'),
      h('div.shop-name', d.name),
      d.desc ? h('div.shop-desc', d.desc) : null,
      locked
        ? h('div.shop-lock', `🔒 Cấp ${d.level}`)
        : soldOut
          ? h('div.shop-owned', '✔ Đã có')
          : button(
              d.price > 0 ? [coinIcon(), h('span', String(d.price))] : 'Nhận',
              (e) => {
                e.stopPropagation();
                buy(d);
              },
              `btn-small ${affordable ? 'btn-green' : 'btn-soft'} shop-buy`,
            ),
      stackable(d) && n > 0 ? h('div.shop-count', `Có ${n}`) : null,
    );
    if (tryOn?.id === d.id) el.classList.add('trying');
    return el;
  };

  const render = () => {
    tabsEl.replaceChildren(
      ...SHOP_TABS.map((t, i) =>
        h(
          `button.menu-tab${i === tab ? '.on' : ''}`,
          {
            type: 'button',
            onclick: () => {
              if (tab === i) return;
              tab = i;
              sfx('click');
              render();
            },
          },
          h('span.menu-tab-i', t.icon),
          t.label,
        ),
      ),
    );
    const list = shopList(SHOP_TABS[tab].cats);
    grid.replaceChildren(...list.map(card));
    if (!list.length && SHOP_TABS[tab].cats.includes('outfit')) grid.appendChild(h('div.menu-empty', 'Bộ đồ mới sắp về! Bạn quay lại sau nhé.'));
    grid.scrollTop = 0;
  };

  const body = h(
    'div.shop',
    h(
      'div.shop-side',
      h('div.shop-wallet', coinIcon(), coinsEl, h('small', 'xu')),
      h('div.shop-stage', preview),
      previewName,
      h('div.shop-tip', 'Chạm vào món đồ để mặc thử. Bấm nút giá để mua!'),
    ),
    h('div.shop-main', tabsEl, grid),
  );
  refreshWallet();
  refreshPreview();
  render();
  // Đổi bé trai ↔ bé gái khi cửa hàng đang mở: bày lại bộ đồ của bé.
  let shownKid = profile().kid;
  const off = bus.on('look', () => {
    if (profile().kid === shownKid) return;
    shownKid = profile().kid;
    tryOn = null;
    refreshPreview();
    render();
  });
  const m = openModal({ title: 'Cửa hàng Cô Mèo', icon: '🛍️', width: 1760, height: 1000, body, className: 'shop-modal', onClose: off });
  return m.closed;
}

/** Tên danh mục (dùng cho túi đồ). */
export function catName(cat: ItemCat): string {
  return CAT_NAMES[cat];
}

/** Món đồ có trong cửa hàng không (để gợi ý). */
export function inShop(id: string): boolean {
  const d = item(id);
  return !!d && !d.hidden && (d.cat === 'outfit' ? d.id !== DEFAULT_OUTFIT : d.price > 0);
}
