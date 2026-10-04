import { sfx } from '../core/audio';
import { bus } from '../core/events';
import { badgeDef, levelDef, levelProgress } from '../core/progression';
import { hasProfile, profile } from '../core/state';
import { setVirtualMove } from '../world/input';
import { button, h, type Child } from './dom';
import { coinIcon } from './icons';
import { openModal } from './modal';
import { inputBlocked, layer } from './root';
import { setPlayerPortrait } from './portrait';
import { confetti } from './toast';

/**
 * Giao diện khi đi trong thế giới (HUD): thẻ nhân vật + XP, ví, nhiệm vụ, nút menu,
 * nút hành động, cần điều khiển cảm ứng, nút xoay camera, băng rôn tên khu vực,
 * và màn chúc mừng lên cấp / nhận huy hiệu (xếp hàng, hiện khi trẻ rảnh tay).
 */
export interface HudHandlers {
  map?(): void;
  bag?(): void;
  minis?(): void;
  settings?(): void;
  rotate?(deg: number): void;
  jump?(): void;
}

interface ActionDef {
  label: string;
  icon: string;
  press: () => void;
}

/** Thiết bị cảm ứng là chính (điện thoại, máy tính bảng). Máy tính có màn cảm ứng: cần điều khiển hiện khi chạm màn hình. */
const coarsePointer = () => window.matchMedia?.('(pointer: coarse)').matches ?? false;

class Hud {
  private root: HTMLElement | null = null;
  private els: Record<string, HTMLElement> = {};
  private handlers: HudHandlers = {};
  private action: ActionDef | null = null;
  private actionKey = '';
  visible = false;
  private queue: (() => Promise<void>)[] = [];
  private pumping = false;
  private offs: (() => void)[] = [];
  private bannerTimer = 0;
  private last = { coins: -1, stars: -1, tickets: -1, keys: -1 };

  bind(h: HudHandlers): void {
    this.handlers = { ...this.handlers, ...h };
  }

  private build(): HTMLElement {
    const e = this.els;
    const menuBtn = (icon: string, label: string, key: string, fn: () => void, cls = '') =>
      h(
        `button.hud-mbtn${cls ? '.' + cls : ''}`,
        {
          type: 'button',
          title: `${label} (${key})`,
          onclick: (ev: MouseEvent) => {
            ev.stopPropagation();
            if (inputBlocked()) return;
            sfx('click');
            fn();
          },
        },
        h('span.hud-mbtn-icon', icon),
        h('span.hud-mbtn-label', label),
      );

    e.avatar = h('img.hud-avatar', { alt: '', draggable: false });
    e.level = h('div.hud-level', '1');
    e.name = h('div.hud-name');
    e.title = h('div.hud-title');
    e.xpFill = h('div.hud-xp-fill');
    e.xpText = h('div.hud-xp-text');
    const card = h(
      'div.hud-card',
      h('div.hud-avatar-wrap', e.avatar, e.level),
      h('div.hud-card-info', e.name, e.title, h('div.hud-xp', e.xpFill, e.xpText)),
    );

    const chip = (k: string, icon: Child, tip: string) => {
      e[k] = h('span.hud-chip-n', '0');
      e[`${k}Chip`] = h(`div.hud-chip.chip-${k}`, { title: tip }, h('span.hud-chip-i', icon), e[k]);
      return e[`${k}Chip`];
    };
    const wallet = h('div.hud-wallet', chip('coins', coinIcon(), 'Xu'), chip('stars', '⭐', 'Ngôi sao'), chip('tickets', '🎟️', 'Vé'), chip('keys', '🗝️', 'Chìa khóa'));

    e.quest = h('div.hud-quest', h('span.hud-quest-i'), h('span.hud-quest-t'));

    const menu = h(
      'div.hud-menu',
      menuBtn('🗺️', 'Bản đồ', 'M', () => this.handlers.map?.()),
      menuBtn('🎒', 'Túi đồ', 'B', () => this.handlers.bag?.()),
      menuBtn('🎮', 'Trò chơi', 'G', () => this.handlers.minis?.()),
      menuBtn('⚙️', 'Cài đặt', 'Esc', () => this.handlers.settings?.()),
    );

    const camBtn = (icon: string, deg: number, tip: string) =>
      h(
        'button.hud-cam',
        {
          type: 'button',
          title: tip,
          onclick: (ev: MouseEvent) => {
            ev.stopPropagation();
            if (inputBlocked()) return;
            this.handlers.rotate?.(deg);
          },
        },
        icon,
      );
    const cams = h('div.hud-cams', camBtn('⟲', -45, 'Xoay camera (Q)'), camBtn('⟳', 45, 'Xoay camera (.)'));

    e.actIcon = h('span.hud-act-icon');
    e.actLabel = h('span.hud-act-label');
    e.action = h(
      'button.hud-action',
      {
        type: 'button',
        onpointerdown: (ev: PointerEvent) => ev.stopPropagation(),
        onclick: (ev: MouseEvent) => {
          ev.stopPropagation();
          if (this.action && !inputBlocked()) this.action.press();
        },
      },
      e.actIcon,
      e.actLabel,
      h('span.hud-act-key', 'E'),
    );
    e.jump = h(
      'button.hud-jump',
      {
        type: 'button',
        title: 'Nhảy (Space)',
        onpointerdown: (ev: PointerEvent) => {
          ev.stopPropagation();
          if (!inputBlocked()) this.handlers.jump?.();
        },
      },
      h('span', '⤴'),
      h('small', 'Nhảy'),
    );

    e.banner = h('div.hud-banner');
    const root = h('div.hud.hud-passive', card, wallet, e.quest, menu, cams, e.action, e.jump, e.banner, this.buildStick());
    if (coarsePointer()) root.classList.add('touch');
    return root;
  }

  /** Cần điều khiển ảo cho màn hình cảm ứng. */
  private buildStick(): HTMLElement {
    const knob = h('div.hud-stick-knob');
    const base = h('div.hud-stick', h('div.hud-stick-ring'), knob);
    const R = 92;
    let id = -1;
    let cx = 0;
    let cy = 0;
    const scale = () => base.getBoundingClientRect().width / 240 || 1;
    const set = (x: number, y: number) => {
      const s = scale();
      let dx = (x - cx) / s;
      let dy = (y - cy) / s;
      const d = Math.hypot(dx, dy);
      if (d > R) {
        dx = (dx / d) * R;
        dy = (dy / d) * R;
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const k = Math.hypot(dx, dy) / R;
      setVirtualMove(k < 0.12 ? 0 : dx / R, k < 0.12 ? 0 : dy / R);
    };
    base.addEventListener('pointerdown', (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      if (id !== -1) return;
      id = ev.pointerId;
      base.setPointerCapture(ev.pointerId);
      const r = base.getBoundingClientRect();
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
      base.classList.add('on');
      set(ev.clientX, ev.clientY);
    });
    base.addEventListener('pointermove', (ev) => {
      if (ev.pointerId === id) set(ev.clientX, ev.clientY);
    });
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return;
      id = -1;
      base.classList.remove('on');
      knob.style.transform = '';
      setVirtualMove(0, 0);
    };
    base.addEventListener('pointerup', end);
    base.addEventListener('pointercancel', end);
    return base;
  }

  show(): void {
    if (!this.root) {
      this.root = this.build();
      layer('hud').appendChild(this.root);
      this.listen();
    }
    this.root.classList.remove('hidden');
    this.visible = true;
    this.refresh();
    void this.pump();
  }

  hide(): void {
    this.root?.classList.add('hidden');
    this.visible = false;
    setVirtualMove(0, 0);
  }

  /** Gỡ hẳn HUD (về màn hình tiêu đề). */
  destroy(): void {
    for (const off of this.offs) off();
    this.offs = [];
    this.root?.remove();
    this.root = null;
    this.els = {};
    this.visible = false;
    this.action = null;
    this.actionKey = '';
    this.queue = [];
    this.last = { coins: -1, stars: -1, tickets: -1, keys: -1 };
    setVirtualMove(0, 0);
  }

  private listen(): void {
    this.offs.push(
      bus.on('wallet', () => this.refreshWallet()),
      bus.on('xp', () => this.refreshCard()),
      bus.on('look', () => this.refreshCard()),
      bus.on('profile', () => this.refresh()),
      bus.on('levelup', ({ level }) => this.celebrate(() => levelUpModal(level))),
      bus.on('badge', ({ id }) => this.celebrate(() => badgeModal(id))),
    );
    const onKey = (ev: KeyboardEvent) => {
      if (!this.visible || ev.defaultPrevented || ev.repeat || inputBlocked()) return;
      const t = ev.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const map: Record<string, (() => void) | undefined> = {
        KeyM: this.handlers.map,
        KeyB: this.handlers.bag,
        KeyI: this.handlers.bag,
        KeyG: this.handlers.minis,
        Escape: this.handlers.settings,
      };
      const fn = map[ev.code];
      if (fn) {
        ev.preventDefault();
        sfx('click');
        fn();
      }
    };
    window.addEventListener('keydown', onKey);
    this.offs.push(() => window.removeEventListener('keydown', onKey));
    // Cần điều khiển ảo: hiện khi trẻ chạm màn hình, ẩn khi dùng phím di chuyển (máy tính có màn cảm ứng).
    const onTouch = (ev: PointerEvent) => {
      if (ev.pointerType === 'touch') this.root?.classList.add('touch');
    };
    const onMoveKey = (ev: KeyboardEvent) => {
      if (/^(Key[WASD]|Arrow)/.test(ev.code) && !coarsePointer()) this.root?.classList.remove('touch');
    };
    window.addEventListener('pointerdown', onTouch, true);
    window.addEventListener('keydown', onMoveKey, true);
    this.offs.push(
      () => window.removeEventListener('pointerdown', onTouch, true),
      () => window.removeEventListener('keydown', onMoveKey, true),
    );
  }

  refresh(): void {
    if (!this.root || !hasProfile()) return;
    this.refreshCard();
    this.refreshWallet();
  }

  private refreshCard(): void {
    if (!this.root || !hasProfile()) return;
    const p = profile();
    const e = this.els;
    setPlayerPortrait(e.avatar as HTMLImageElement, p.kid, p.equipped, { framing: 'head', size: 200, yaw: 16 });
    const lp = levelProgress(p.xp);
    e.level.textContent = String(lp.level);
    e.name.textContent = p.name;
    e.title.textContent = levelDef(lp.level).title;
    e.xpFill.style.width = `${Math.round(lp.pct * 100)}%`;
    e.xpText.textContent = lp.max ? `${p.xp} XP · Cấp cao nhất!` : `${lp.cur} / ${lp.need} XP`;
  }

  private refreshWallet(): void {
    if (!this.root || !hasProfile()) return;
    const p = profile();
    const e = this.els;
    for (const k of ['coins', 'stars', 'tickets', 'keys'] as const) {
      const v = p[k];
      e[k].textContent = String(v);
      if (this.last[k] >= 0 && v > this.last[k]) {
        const c = e[`${k}Chip`];
        c.classList.remove('bump');
        void c.offsetWidth;
        c.classList.add('bump');
      }
      this.last[k] = v;
    }
    e.keysChip.classList.toggle('hidden', p.keys <= 0);
    e.ticketsChip.classList.toggle('dim', p.tickets <= 0);
  }

  /** Nút hành động khi đứng gần một thứ có thể tương tác (null = ẩn). */
  setAction(a: ActionDef | null): void {
    if (!this.root) return;
    const key = a ? `${a.icon}|${a.label}` : '';
    this.action = a;
    if (key === this.actionKey) return;
    this.actionKey = key;
    const e = this.els;
    if (!a) {
      e.action.classList.remove('show');
      return;
    }
    e.actIcon.textContent = a.icon;
    e.actLabel.textContent = a.label;
    e.action.classList.remove('show');
    void e.action.offsetWidth;
    e.action.classList.add('show');
  }

  /** Băng rôn tên khu vực khi vừa vào. */
  banner(icon: string, title: string, sub = ''): void {
    if (!this.root) return;
    const b = this.els.banner;
    b.innerHTML = '';
    b.append(h('div.hud-banner-icon', icon), h('div.hud-banner-title', title), sub ? h('div.hud-banner-sub', sub) : '');
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => b.classList.remove('show'), 3200);
  }

  /** Dòng nhiệm vụ hiện tại (null = ẩn). */
  objective(text: string | null, icon = '📜'): void {
    if (!this.root) return;
    const q = this.els.quest;
    if (!text) {
      q.classList.remove('show');
      return;
    }
    const [i, t] = [q.firstElementChild as HTMLElement, q.lastElementChild as HTMLElement];
    if (t.textContent !== text) {
      i.textContent = icon;
      t.textContent = text;
      q.classList.remove('show', 'flash');
      void q.offsetWidth;
      q.classList.add('show', 'flash');
    } else q.classList.add('show');
  }

  /** Xếp hàng một màn chúc mừng – hiện khi HUD đang hiện và trẻ không bận hội thoại/câu hỏi. */
  celebrate(fn: () => Promise<void>): void {
    this.queue.push(fn);
    void this.pump();
  }

  private async pump(): Promise<void> {
    if (this.pumping) return;
    this.pumping = true;
    try {
      while (this.queue.length) {
        while (!this.visible || inputBlocked()) {
          await new Promise((r) => setTimeout(r, 300));
          if (!this.root) {
            this.queue = [];
            return;
          }
        }
        await new Promise((r) => setTimeout(r, 350));
        if (!this.visible || inputBlocked()) continue;
        const fn = this.queue.shift();
        if (fn) await fn();
      }
    } finally {
      this.pumping = false;
    }
  }
}

export const hud = new Hud();

/* ---------------- Màn chúc mừng ---------------- */
function levelUpModal(level: number): Promise<void> {
  const def = levelDef(level);
  sfx('levelup');
  confetti(110);
  const m = openModal({
    title: 'Lên cấp rồi!',
    icon: '🎉',
    width: 980,
    className: 'celebrate-modal',
    body: h(
      'div.celebrate',
      h('div.cel-level', h('span', 'Cấp'), h('b', String(level))),
      h('div.cel-title', def.title),
      def.unlocks.length ? h('div.cel-sub', 'Bạn vừa mở khóa:') : null,
      def.unlocks.length ? h('ul.cel-list', def.unlocks.map((u) => h('li', u))) : null,
    ),
    footer: button('Tuyệt vời! 🎉', () => m.close(), 'btn-primary btn-big'),
  });
  return m.closed;
}

function badgeModal(id: string): Promise<void> {
  const b = badgeDef(id);
  if (!b) return Promise.resolve();
  sfx('badge');
  confetti(90);
  const m = openModal({
    title: 'Huy hiệu mới!',
    icon: '🏅',
    width: 900,
    className: 'celebrate-modal',
    body: h(
      'div.celebrate',
      h('div.cel-badge', { style: { background: b.color } }, b.icon),
      h('div.cel-title', b.name),
      h('div.cel-desc', b.desc),
      h('div.cel-sub', 'Huy hiệu đã được đặt lên kệ trong ngôi nhà của bạn.'),
    ),
    footer: button('Tuyệt quá! 🏅', () => m.close(), 'btn-primary btn-big'),
  });
  return m.closed;
}
