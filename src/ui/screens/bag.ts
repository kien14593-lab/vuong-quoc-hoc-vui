import { sfx } from '../../core/audio';
import { bus } from '../../core/events';
import { CAT_NAMES, item, ITEMS, type ItemCat } from '../../core/items';
import { DEFAULT_OUTFIT, KID_NAMES, KIDS, OUTFITS, outfitFits } from '../../core/outfits';
import { BADGES, badgeVisible } from '../../core/progression';
import { equip, hasBadge, profile, setKid } from '../../core/state';
import { button, h } from '../dom';
import { coinIcon } from '../icons';
import { itemThumb } from '../itemArt';
import { openModal } from '../modal';
import { setPlayerPortrait } from '../portrait';

type Tab = 'wear' | 'pet' | 'items' | 'badges';

const WEAR_CATS: ItemCat[] = ['outfit', 'hat', 'backpack', 'acc'];
const OPTIONAL: ItemCat[] = ['hat', 'backpack', 'acc', 'pet', 'board'];
const KID_ICON = { trai: '👦', gai: '👧' } as const;

/** Túi đồ: chọn bé trai / bé gái, thay bộ đồ, mũ, balo, phụ kiện, chọn thú cưng, xem vật phẩm và huy hiệu. */
export function openBag(start: Tab = 'wear'): void {
  let tab: Tab = start;
  let cat: ItemCat = 'outfit';
  const tabsEl = h('div.menu-tabs');
  const content = h('div.bag-content');
  const kidsEl = h('div.bag-kids');
  const preview = h<HTMLImageElement>('img.shop-preview', { alt: '', draggable: false });
  let yaw = 18;

  const refreshPreview = () => {
    const p = profile();
    setPlayerPortrait(preview, p.kid, p.equipped, { framing: 'full', size: 420, yaw });
  };

  const equipped = (c: ItemCat): string | null => (profile().equipped as unknown as Record<string, string | null>)[c] ?? null;

  /** Bộ đồ đã có: bộ mặc được thì chạm để mặc; bộ chỉ có cho bé kia thì hiện mờ. */
  const outfitGrid = () => {
    const p = profile();
    const other = KIDS.find((k) => k !== p.kid)!;
    const mine = OUTFITS.filter((o) => o.id === DEFAULT_OUTFIT || (p.inventory[o.id] ?? 0) > 0);
    const grid = h('div.shop-grid.bag-grid');
    for (const d of mine) {
      const fits = outfitFits(p.kid, d.id);
      const on = p.equipped.outfit === d.id;
      grid.appendChild(
        h(
          `div.shop-card.bag-card${on ? '.on' : ''}${fits ? '' : '.locked'}`,
          {
            onclick: () => {
              if (on || !fits) return;
              equip('outfit', d.id);
              sfx('pop');
              render();
            },
          },
          itemThumb(d.id, 'item-art'),
          h('div.shop-name', d.name),
          on ? h('div.bag-on', '✔ Đang mặc') : fits ? null : h('div.shop-lock', `Chỉ có cho ${KID_NAMES[other].toLowerCase()}`),
        ),
      );
    }
    if (mine.length < 2) grid.appendChild(h('div.menu-empty', 'Ghé Cửa hàng của Cô Mèo để có thêm bộ đồ mới nhé!'));
    return grid;
  };

  const itemGrid = (cats: ItemCat[]) => {
    const p = profile();
    const owned = ITEMS.filter((d) => cats.includes(d.cat) && (p.inventory[d.id] ?? 0) > 0);
    const grid = h('div.shop-grid.bag-grid');
    if (OPTIONAL.includes(cats[0]) && cats.length === 1) {
      const none = equipped(cats[0]) === null;
      grid.appendChild(
        h(
          `div.shop-card.bag-card${none ? '.on' : ''}`,
          {
            onclick: () => {
              equip(cats[0] as Parameters<typeof equip>[0], null);
              sfx('pop');
              render();
            },
          },
          h('div.item-art', h('span.item-art-emoji', '🚫')),
          h('div.shop-name', 'Không dùng'),
        ),
      );
    }
    for (const d of owned) {
      const on = equipped(d.cat) === d.id;
      grid.appendChild(
        h(
          `div.shop-card.bag-card${on ? '.on' : ''}`,
          {
            onclick: () => {
              if (on && !OPTIONAL.includes(d.cat)) return;
              equip(d.cat as Parameters<typeof equip>[0], on ? null : d.id);
              sfx('pop');
              render();
            },
          },
          itemThumb(d.id, 'item-art'),
          h('div.shop-name', d.name),
          on ? h('div.bag-on', '✔ Đang dùng') : null,
        ),
      );
    }
    if (!owned.length) grid.appendChild(h('div.menu-empty', 'Chưa có món nào. Hãy ghé Cửa hàng của Cô Mèo nhé!'));
    return grid;
  };

  /** Nút chọn bé trai / bé gái (giữ nguyên mọi bộ đồ đã có). */
  const renderKids = () => {
    const cur = profile().kid;
    kidsEl.replaceChildren(
      ...KIDS.map((k) =>
        h(
          `button.bag-kid.${k}${k === cur ? '.on' : ''}`,
          {
            type: 'button',
            onclick: () => {
              if (k === profile().kid) return;
              setKid(k);
              sfx('pop');
              render();
            },
          },
          h('span.bag-kid-i', KID_ICON[k]),
          KID_NAMES[k],
        ),
      ),
    );
  };

  const render = () => {
    const tabs: [Tab, string, string][] = [
      ['wear', '👕', 'Trang phục'],
      ['pet', '🐶', 'Thú cưng'],
      ['items', '🎁', 'Vật phẩm'],
      ['badges', '🏅', 'Huy hiệu'],
    ];
    tabsEl.replaceChildren(
      ...tabs.map(([id, icon, label]) =>
        h(
          `button.menu-tab${tab === id ? '.on' : ''}`,
          {
            type: 'button',
            onclick: () => {
              if (tab === id) return;
              tab = id;
              sfx('click');
              render();
            },
          },
          h('span.menu-tab-i', icon),
          label,
        ),
      ),
    );
    content.replaceChildren();
    if (tab === 'wear') {
      const sub = h(
        'div.bag-subtabs',
        ...WEAR_CATS.map((c) =>
          h(
            `button.bag-subtab${cat === c ? '.on' : ''}`,
            {
              type: 'button',
              onclick: () => {
                cat = c;
                sfx('click');
                render();
              },
            },
            CAT_NAMES[c],
          ),
        ),
      );
      content.append(sub, cat === 'outfit' ? outfitGrid() : itemGrid([cat]));
    } else if (tab === 'pet') {
      content.append(h('div.bag-section', 'Thú cưng đi theo bạn'), itemGrid(['pet']), h('div.bag-section', 'Ván trượt'), itemGrid(['board']));
    } else if (tab === 'items') {
      const p = profile();
      const list = Object.entries(p.inventory).filter(([id, n]) => n > 0 && ['quest', 'seed', 'decor'].includes(item(id)?.cat ?? ''));
      const grid = h('div.shop-grid.bag-grid');
      for (const [id, n] of list) {
        const d = item(id)!;
        grid.appendChild(h('div.shop-card.bag-card.static', itemThumb(id, 'item-art'), h('div.shop-name', d.name), h('div.shop-count', `× ${n}`), h('div.shop-desc', d.cat === 'decor' ? 'Trang trí trong nhà của bạn' : d.cat === 'seed' ? 'Trồng trong vườn nhà bạn' : (d.desc ?? 'Vật phẩm nhiệm vụ'))));
      }
      const wallet = h(
        'div.bag-wallet',
        ...([
          [coinIcon(), p.coins, 'xu'],
          ['⭐', p.stars, 'sao'],
          ['🎟️', p.tickets, 'vé'],
          ['🗝️', p.keys, 'chìa khóa'],
        ] as const).map(([i, n, l]) => h('div.bag-wallet-chip', h('span', i), h('b', String(n)), h('small', l))),
      );
      content.append(wallet, list.length ? grid : h('div.menu-empty', 'Túi đồ đang trống. Vật phẩm nhặt được sẽ nằm ở đây!'));
    } else {
      const grid = h('div.badge-grid');
      // Huy hiệu riêng của một môn chỉ hiện khi bé học môn đó (huy hiệu đã nhận thì luôn hiện).
      const shown = BADGES.filter((b) => badgeVisible(b, profile().subject, hasBadge(b.id)));
      for (const b of shown) {
        const got = hasBadge(b.id);
        grid.appendChild(h(`div.badge-card${got ? '.got' : ''}`, { style: { '--bc': b.color } }, h('div.badge-medal', got ? b.icon : '❔'), h('div.badge-name', b.name), h('div.badge-desc', b.desc)));
      }
      const n = shown.filter((b) => hasBadge(b.id)).length;
      content.append(h('div.bag-section', `Bạn đã có ${n} / ${shown.length} huy hiệu`), grid);
    }
    renderKids();
    refreshPreview();
  };

  const body = h(
    'div.shop',
    h(
      'div.shop-side',
      h('div.shop-stage', preview),
      h(
        'div.bag-turn',
        button('⟲', () => {
          yaw = (yaw + 300) % 360;
          refreshPreview();
        }, 'btn-round btn-soft'),
        button('⟳', () => {
          yaw = (yaw + 60) % 360;
          refreshPreview();
        }, 'btn-round btn-soft'),
      ),
      h('div.shop-preview-name', profile().name),
      kidsEl,
    ),
    h('div.shop-main', tabsEl, content),
  );
  render();
  const off = bus.on('look', () => refreshPreview());
  openModal({ title: 'Túi đồ của bạn', icon: '🎒', width: 1760, height: 1000, body, className: 'shop-modal', onClose: off });
}
