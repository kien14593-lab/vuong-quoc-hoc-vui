import * as THREE from 'three';
import { engine } from '../engine/core';
import { h, type Child } from '../ui/dom';
import { layer, uiSize } from '../ui/root';

/**
 * Nhãn HTML gắn vào vị trí 3D: tên NPC, dấu "!" nhiệm vụ, bong bóng lời nói, số trên vật thể.
 * Vẽ ở lớp giao diện "world" (dưới HUD), cập nhật vị trí mỗi khung hình.
 */
export interface LabelOpts {
  /** Đối tượng để bám theo (vị trí thế giới của nó + y). */
  obj?: THREE.Object3D;
  /** Hoặc vị trí cố định. */
  pos?: THREE.Vector3 | [number, number, number];
  /** Độ cao phía trên gốc đối tượng. */
  y?: number;
  text?: string;
  cls?: string;
  /** Ẩn khi xa camera quá khoảng này (mét). */
  maxDist?: number;
  /** Không để nhãn lọt vào vùng bị che ở trên cùng (`Labels.topInset`, ví dụ thẻ đề bài) – đẩy xuống ngay dưới. */
  clampTop?: boolean;
  /** Cộng thêm vào thứ tự chồng lớp (nhãn quan trọng nằm trên các nhãn khác). */
  z?: number;
  /** Nhóm nhãn không được đè lên nhau trên màn hình (dàn ra hai bên, giữ thứ tự trái → phải). */
  spread?: string;
  /** Phần tử tùy chỉnh. */
  el?: HTMLElement;
}

interface Placed {
  l: Label;
  x: number;
  y: number;
  w: number;
  h: number;
}

export class Label {
  readonly el: HTMLElement;
  private markEl: HTMLElement | null = null;
  private textEl: HTMLElement | null = null;
  private box: { w: number; h: number } | null = null;
  hidden = false;
  readonly world = new THREE.Vector3();

  constructor(
    readonly o: LabelOpts,
    private owner: Labels,
  ) {
    if (o.el) this.el = o.el;
    else {
      this.textEl = o.text ? h('span.wl-text', o.text) : null;
      this.el = h(`div.wlabel${o.cls ? '.' + o.cls.split(' ').join('.') : ''}`, this.textEl);
    }
    this.el.classList.add('wl');
  }

  setText(t: string): void {
    if (!this.textEl) {
      this.textEl = h('span.wl-text');
      this.el.appendChild(this.textEl);
    }
    this.textEl.textContent = t;
    this.box = null;
  }

  /** Kích thước (px, chưa nhân tỉ lệ giao diện) của khối nội dung chính – đo một lần rồi nhớ. */
  size(): { w: number; h: number } {
    if (this.box) return this.box;
    const c = this.el.firstElementChild as HTMLElement | null;
    const b = { w: c?.offsetWidth ?? 0, h: c?.offsetHeight ?? 0 };
    if (b.w > 0 && b.h > 0) this.box = b;
    return b;
  }

  /** Dấu hiệu phía trên: '!' (có việc), '?' (đang làm), '' (không). */
  setMark(m: '' | '!' | '?' | '★'): void {
    if (!m) {
      this.markEl?.remove();
      this.markEl = null;
      return;
    }
    if (!this.markEl) {
      this.markEl = h('span.wl-mark');
      this.el.prepend(this.markEl);
    }
    this.markEl.textContent = m;
    this.markEl.dataset.m = m;
  }

  show(v: boolean): void {
    this.hidden = !v;
    if (!v) this.el.style.display = 'none';
  }

  remove(): void {
    this.owner.remove(this);
  }
}

export class Labels {
  private items = new Set<Label>();
  private v = new THREE.Vector3();
  readonly root: HTMLElement;
  /** Mép dưới (px, tọa độ màn hình) của vùng giao diện che phía trên – dùng cho nhãn `clampTop`. */
  topInset = 0;

  constructor(private camera: THREE.Camera) {
    this.root = h('div.wlabels');
    layer('world').appendChild(this.root);
  }

  add(o: LabelOpts): Label {
    const l = new Label(o, this);
    this.items.add(l);
    this.root.appendChild(l.el);
    return l;
  }

  remove(l: Label): void {
    this.items.delete(l);
    l.el.remove();
  }

  /** Bong bóng lời nói tạm thời phía trên đối tượng. */
  bubble(obj: THREE.Object3D, text: string, y = 2.2, ms = 2600): void {
    const l = this.add({ obj, y, text, cls: 'wl-bubble', maxDist: 60 });
    window.setTimeout(() => {
      l.el.classList.add('out');
      window.setTimeout(() => l.remove(), 300);
    }, ms);
  }

  /** Chữ bay lên (ví dụ "+1 ⭐"). Nhận cả phần tử (ví dụ đồng xu vẽ – ui/icons.ts). */
  float(pos: THREE.Vector3, text: Child, cls = ''): void {
    const el = h(`div.wlabel.wl-float${cls ? '.' + cls.split(' ').join('.') : ''}`, h('span.wl-text', text));
    const l = this.add({ pos: pos.clone(), y: 0, el, maxDist: 80 });
    window.setTimeout(() => l.remove(), 1300);
  }

  update(): void {
    const { s } = uiSize();
    const w = engine.w;
    const hgt = engine.h;
    const camPos = this.camera.position;
    let groups: Map<string, Placed[]> | null = null;
    for (const l of this.items) {
      if (l.hidden) continue;
      const o = l.o;
      if (o.obj) {
        if (!o.obj.parent) {
          l.el.style.display = 'none';
          continue;
        }
        o.obj.getWorldPosition(this.v);
      } else if (o.pos) {
        if (Array.isArray(o.pos)) this.v.set(o.pos[0], o.pos[1], o.pos[2]);
        else this.v.copy(o.pos);
      }
      this.v.y += o.y ?? 0;
      l.world.copy(this.v);
      const d = this.v.distanceTo(camPos);
      if (o.maxDist && d > o.maxDist) {
        l.el.style.display = 'none';
        continue;
      }
      this.v.project(this.camera);
      if (this.v.z > 1 || this.v.z < -1 || Math.abs(this.v.x) > 1.2 || Math.abs(this.v.y) > 1.2) {
        l.el.style.display = 'none';
        continue;
      }
      const x = ((this.v.x + 1) / 2) * w;
      let y = ((1 - this.v.y) / 2) * hgt;
      l.el.style.display = '';
      if (o.clampTop && this.topInset > 0) {
        // Mốc của nhãn là mép dưới → cần chừa đủ chiều cao của cả nhãn.
        const minY = this.topInset + l.size().h * s + 10;
        l.el.classList.toggle('clamped', y < minY);
        if (y < minY) y = minY;
      }
      l.el.style.zIndex = String(Math.round(1000 - d * 4 + (o.z ?? 0)));
      if (o.spread) {
        const b = l.size();
        const g = (groups ??= new Map()).get(o.spread);
        const it = { l, x, y, w: b.w * s, h: b.h * s };
        if (g) g.push(it);
        else groups.set(o.spread, [it]);
        continue;
      }
      l.el.style.transform = `translate(${(x / s).toFixed(1)}px, ${(y / s).toFixed(1)}px)`;
    }
    if (groups) for (const g of groups.values()) this.spreadOut(g, s);
  }

  /** Đẩy các nhãn cùng nhóm đang đè nhau ra hai bên (ít dịch chuyển nhất, giữ thứ tự theo trục ngang). */
  private spreadOut(g: Placed[], s: number): void {
    g.sort((a, b) => a.x - b.x);
    const gap = 6 * s;
    for (let pass = 0; pass < 12; pass++) {
      let moved = false;
      for (let i = 0; i < g.length - 1; i++) {
        const a = g[i];
        const b = g[i + 1];
        if (Math.abs(a.y - b.y) >= (a.h + b.h) / 2) continue;
        const over = (a.w + b.w) / 2 + gap - (b.x - a.x);
        if (over > 0.5) {
          a.x -= over / 2;
          b.x += over / 2;
          moved = true;
        }
      }
      if (!moved) break;
    }
    for (const it of g) it.l.el.style.transform = `translate(${(it.x / s).toFixed(1)}px, ${(it.y / s).toFixed(1)}px)`;
  }

  dispose(): void {
    for (const l of this.items) l.el.remove();
    this.items.clear();
    this.root.remove();
  }
}
