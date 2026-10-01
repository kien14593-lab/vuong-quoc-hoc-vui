import * as THREE from 'three';
import { sfx } from '../../core/audio';
import { ball, box, cone, cyl, group, rbox, tube } from '../../engine/kit';
import { PAL } from '../../engine/materials';
import { numberBadge, textPlate } from '../../engine/text';
import type { Question } from '../../math/types';
import { parseVi } from '../../math/util';
import { MiniGame, type MiniRound } from '../base';
import { defineMini } from '../registry';

type MoneyItem = { emoji: string; name: string; price: number; qty?: number };

const INK = '#2b2233';
const GOLD = '#ffcf3f';
const DENOMS = [50, 20, 10, 5, 2, 1];

function moneyValue(s: string): number {
  const m = s.match(/[0-9\s\u00a0,.]+/);
  return m ? parseVi(m[0]) : 0;
}

function itemMesh(item: MoneyItem, i: number): THREE.Group {
  const colors = ['#ff6b6b', '#ffd166', '#7bd389', '#6cb8ff', '#ff9ec7'];
  const c = colors[i % colors.length];
  const g = new THREE.Group();
  if (item.name.includes('chuối')) {
    g.add(group([
      cyl(0.045, 0.045, 0.45, '#ffd166', { p: [-0.08, 0.28, 0], r: [25, 0, 25], seg: 8 }),
      cyl(0.045, 0.045, 0.45, '#ffd166', { p: [0.04, 0.3, 0], r: [15, 0, -10], seg: 8 }),
      cyl(0.045, 0.045, 0.45, '#ffd166', { p: [0.15, 0.28, 0], r: [25, 0, -25], seg: 8 }),
    ]));
  } else if (item.name.includes('táo')) {
    g.add(ball(0.22, '#ff5a5f', { p: [0, 0.28, 0], seg: 12, flat: false, shiny: 35 }));
    g.add(cyl(0.015, 0.02, 0.12, '#7b4a2e', { p: [0.02, 0.5, 0], seg: 5 }));
    g.add(box(0.12, 0.035, 0.05, PAL.leaf2, { p: [0.08, 0.5, 0], r: [0, 0, -20] }));
  } else if (item.name.includes('kem')) {
    g.add(cone(0.18, 0.46, '#d99a55', { p: [0, 0.23, 0], r: [180, 0, 0], seg: 14 }));
    g.add(ball(0.2, '#fff0a8', { p: [-0.06, 0.54, 0], seg: 14, flat: false, shiny: 25 }));
    g.add(ball(0.18, '#ff9ec7', { p: [0.09, 0.66, 0.02], seg: 14, flat: false, shiny: 25 }));
  } else if (item.name.includes('kẹo')) {
    g.add(ball(0.21, '#ff6b6b', { p: [0, 0.35, 0], s: [1.35, 0.78, 0.78], seg: 14, flat: false, shiny: 45 }));
    g.add(cone(0.12, 0.18, '#ffd166', { p: [-0.32, 0.35, 0], r: [0, 0, 90], seg: 10 }));
    g.add(cone(0.12, 0.18, '#ffd166', { p: [0.32, 0.35, 0], r: [0, 0, -90], seg: 10 }));
  } else if (item.name.includes('bóng bay')) {
    g.add(ball(0.24, '#ff9ec7', { p: [0, 0.62, 0], s: [0.9, 1.12, 0.9], seg: 14, flat: false, shiny: 35 }));
    g.add(cone(0.045, 0.08, '#ff9ec7', { p: [0, 0.35, 0], r: [180, 0, 0], seg: 8 }));
    g.add(tube([[0, 0.32, 0], [0.04, 0.14, 0], [-0.02, 0.02, 0]], 0.01, '#7b4a2e', { radial: 5, seg: 10 }));
  } else if (item.name.includes('bánh')) {
    g.add(cyl(0.24, 0.24, 0.2, '#f4a261', { p: [0, 0.22, 0], seg: 18 }));
    g.add(cyl(0.25, 0.25, 0.08, '#fff0d2', { p: [0, 0.36, 0], seg: 18 }));
    g.add(ball(0.05, '#ff5a5f', { p: [0.04, 0.43, 0.04], seg: 8, flat: false }));
  } else if (item.name.includes('sữa') || item.name.includes('nước')) {
    g.add(rbox(0.34, 0.58, 0.26, 0.05, item.name.includes('nước') ? '#ffe8a3' : '#fff8ee', { p: [0, 0.3, 0] }));
    g.add(box(0.28, 0.22, 0.03, item.name.includes('nước') ? '#ff9f43' : '#6cb8ff', { p: [0, 0.3, 0.15] }));
    g.add(box(0.18, 0.08, 0.2, '#ffffff', { p: [0, 0.62, 0] }));
  } else if (item.name.includes('bút')) {
    g.add(cyl(0.045, 0.045, 0.58, '#ffd166', { p: [0, 0.34, 0], r: [0, 0, 90], seg: 8 }));
    g.add(cone(0.055, 0.14, '#7b4a2e', { p: [0.36, 0.34, 0], r: [0, 0, -90], seg: 8 }));
    g.add(box(0.12, 0.08, 0.09, '#ff6b6b', { p: [-0.34, 0.34, 0] }));
  } else if (item.name.includes('vở')) {
    g.add(rbox(0.38, 0.52, 0.08, 0.025, '#6cb8ff', { p: [0, 0.3, 0], r: [-12, 0, 0], shiny: 20 }));
    g.add(box(0.035, 0.52, 0.09, '#ffffff', { p: [-0.16, 0.3, 0.01], r: [-12, 0, 0] }));
  } else {
    g.add(rbox(0.42, 0.36, 0.42, 0.06, c, { p: [0, 0.2, 0], shiny: 35 }));
  }
  const tag = textPlate(`${item.qty && item.qty > 1 ? `${item.qty}× ` : ''}${item.price} xu`, 0.42, { bg: '#fff8ee', color: INK, border: GOLD, size: 76, pad: 12 });
  tag.position.set(0, 0.96, 0.2);
  g.add(tag);
  return g;
}

function marketStall(): THREE.Group {
  return group([
    rbox(4.6, 0.28, 1.05, 0.08, '#b87938', { p: [0, 0.7, 0], shiny: 18 }),
    rbox(4.95, 0.18, 1.2, 0.08, '#d79b54', { p: [0, 1.15, 0.03], shiny: 18 }),
    box(0.16, 2.25, 0.16, '#7b4a2e', { p: [-2.15, 1.65, 0.15] }),
    box(0.16, 2.25, 0.16, '#7b4a2e', { p: [2.15, 1.65, 0.15] }),
    rbox(5.2, 0.18, 1.2, 0.06, '#28c2b8', { p: [0, 2.85, 0.02], r: [0, 0, -7], shiny: 20 }),
    rbox(1.7, 0.15, 1.22, 0.04, '#ffffff', { p: [-1.6, 2.78, 0.0], r: [0, 0, -7] }),
    rbox(1.7, 0.15, 1.22, 0.04, '#ffffff', { p: [1.6, 2.78, 0.0], r: [0, 0, -7] }),
  ]);
}

function coinOrNote(value: number, idx: number): THREE.Object3D {
  if (value >= 20) {
    const note = group([
      rbox(0.68, 0.34, 0.05, 0.045, value === 50 ? '#7bd389' : '#6cb8ff', { shiny: 25 }),
      numberBadge(value, 0.25, { bg: '#fff8ee', color: INK, border: GOLD }),
    ]);
    note.children[1].position.set(0, 0, 0.025);
    return note;
  }
  return group([
    cyl(0.19, 0.19, 0.055, GOLD, { r: [90, 0, 0], seg: 22, shiny: 80 }),
    numberBadge(value, 0.27, { bg: '#fff8ee', color: INK, border: GOLD }),
  ], { r: [0, 0, 0], p: [0, idx * 0.025, 0] });
}

function moneyPile(value: number, label: string): THREE.Group {
  const g = new THREE.Group();
  g.add(rbox(1.28, 0.18, 0.95, 0.09, '#fff8ee', { p: [0, 0.09, 0] }));
  let rest = value;
  let k = 0;
  for (const d of DENOMS) {
    while (rest >= d && k < 10) {
      rest -= d;
      const coin = coinOrNote(d, k);
      coin.position.set(-0.44 + (k % 5) * 0.23, 0.28 + Math.floor(k / 5) * 0.16, -0.14 + (k % 2) * 0.26);
      coin.rotation.y = (k % 3 - 1) * 0.25;
      g.add(coin);
      k++;
    }
  }
  const badge = textPlate(label, label.length > 5 ? 0.4 : 0.48, { bg: '#ffffff', color: INK, border: '#7bd389', size: 92, pad: 14 });
  badge.position.set(0, 0.95, 0.12);
  g.add(badge);
  return g;
}

class MarketGame extends MiniGame {
  private cashier: THREE.Group | null = null;
  private targets: THREE.Group[] = [];
  private targetValue = new Map<THREE.Group, string>();
  private roundObjs: THREE.Object3D[] = [];
  private roundNow: MiniRound | null = null;
  private tray = new THREE.Vector3(1.7, 0.45, -0.9);

  protected build(): void {
    this.sky('#9fd8f7', '#fff0d2', 45, 125);
    this.ground('#f1e6cc', 70, 70);
    this.view([0, 4.5, 7.0], [0, 0.95, -0.45], 36);
    const stall = marketStall();
    stall.position.set(0, 0, -2.25);
    stall.scale.setScalar(1.22);
    this.scene.add(stall);
    this.model('crate_fruit', undefined, [-3.0, 0, -1.0], 0.3, 1.12);
    this.model('crate_fruit', undefined, [3.0, 0, -0.95], -0.2, 1.12);
    this.cashier = this.model('npc_cat', undefined, [2.0, 0, -1.45], -0.25, 1.12);
    const st = this.cashier && this.anim(this.cashier);
    if (st) st.wave = true;
    this.scene.add(group([
      rbox(1.25, 0.16, 0.9, 0.08, '#d7a56d', { p: [this.tray.x, 0.08, this.tray.z] }),
      rbox(0.9, 0.08, 0.55, 0.04, '#fff8ee', { p: [this.tray.x, 0.22, this.tray.z] }),
    ]));
    this.onPointer('tap', (e) => this.tap(e));
  }

  protected async play(): Promise<void> {
    while (this.more) {
      this.clearRound();
      const q = this.question('money');
      this.renderRound(q);
      const st = this.cashier && this.anim(this.cashier);
      if (st) st.talk = true;
      const round = this.ask(q, { prompt: q.prompt });
      this.roundNow = round;
      await round.done;
      this.roundNow = null;
      if (st) st.talk = false;
      await this.pay(q.answer);
      if (!(await this.nextRound())) break;
    }
  }

  private renderRound(q: Question): void {
    const money = q.visual?.kind === 'money' ? q.visual : undefined;
    const items = money?.items ?? [];
    items.forEach((it, i) => {
      const m = itemMesh(it, i);
      const itemSpacing = items.length <= 2 ? 1.55 : 1.18;
      m.position.set((i - (items.length - 1) / 2) * itemSpacing, 0.2, -0.7);
      m.scale.setScalar(1.12);
      this.scene.add(m);
      this.roundObjs.push(m);
    });
    if (money?.budget) {
      const b = textPlate(`Có ${money.budget} xu`, 0.34, { bg: '#e7f7ff', color: INK, border: GOLD, size: 68, pad: 12 });
      b.position.set(2.55, 1.6, -0.8);
      this.scene.add(b);
      this.roundObjs.push(b);
    }
    q.choices.forEach((c, i) => {
      const compact = q.choices.length > 3;
      const x = (i - (q.choices.length - 1) / 2) * (compact ? 1.12 : 1.48);
      const p = moneyPile(moneyValue(c.label), c.label);
      if (compact) p.scale.setScalar(0.78);
      p.position.set(x, 0.1, 1.6);
      this.scene.add(p);
      this.targets.push(p);
      this.targetValue.set(p, c.value);
      this.roundObjs.push(p);
    });
  }

  private tap(e: PointerEvent): void {
    if (!this.roundNow || this.roundNow.solved) return;
    const hit = this.pick(e.clientX, e.clientY, this.targets);
    if (!hit) return;
    sfx('coin');
    const res = this.roundNow.submit(this.targetValue.get(hit) ?? '');
    if (res.correct) {
      this.tween(0.22, (k) => hit.scale.setScalar(1 + Math.sin(k * Math.PI) * 0.16), { ease: 'linear' });
    } else {
      this.wrong(hit);
    }
  }

  private wrong(o: THREE.Object3D): void {
    const x0 = o.position.x;
    this.tween(0.36, (k) => { o.position.x = x0 + Math.sin(k * Math.PI * 6) * 0.12 * (1 - k); }, { ease: 'linear' });
    const st = this.cashier && this.anim(this.cashier);
    if (st) st.talk = true;
    this.fx.burst('dust', [o.position.x, 0.55, o.position.z], { count: 9, spread: 0.4 });
  }

  private async pay(answer: string): Promise<void> {
    const pile = this.targets.find((t) => this.targetValue.get(t) === answer) ?? this.targets[0];
    const value = moneyValue(answer);
    const count = Math.min(8, Math.max(3, String(value).length + 3));
    const start = pile ? pile.position.clone().add(new THREE.Vector3(0, 0.55, 0)) : new THREE.Vector3(0, 0.5, 2);
    for (let i = 0; i < count; i++) {
      const coin = coinOrNote(i % 3 === 0 ? 10 : 5, i);
      coin.position.copy(start);
      this.scene.add(coin);
      this.roundObjs.push(coin);
      const end = this.tray.clone().add(new THREE.Vector3((i - count / 2) * 0.08, 0.25 + i * 0.012, (i % 2) * 0.1));
      const delay = i * 0.06;
      this.tween(0.65 + delay, (k) => {
        const kk = Math.max(0, Math.min(1, (k * (0.65 + delay) - delay) / 0.65));
        coin.position.lerpVectors(start, end, kk);
        coin.position.y += Math.sin(kk * Math.PI) * 0.9;
        coin.rotation.y += 0.16;
      }, { ease: 'inOutCubic' });
    }
    const st = this.cashier && this.anim(this.cashier);
    if (st) st.happy = 1;
    this.fx.burst('star', [this.tray.x, 1.2, this.tray.z], { count: 28, spread: 1.0 });
    this.ui.flash('Thanh toán đúng!', 'good');
    await this.wait(1.0);
    if (st) st.happy = 0;
  }

  private clearRound(): void {
    for (const o of this.roundObjs) this.remove(o);
    this.roundObjs = [];
    this.targets = [];
    this.targetValue.clear();
  }
}

defineMini(
  {
    id: 'market',
    name: '🛒 Siêu thị – tiền và tính toán',
    icon: '🛒',
    skill: 'Tiền và tính toán',
    topics: ['money', 'add', 'sub'],
    desc: 'Xem bảng giá, chọn khay xu đúng để trả tiền hoặc nhận tiền thừa.',
    rounds: 6,
    color: '#7bd389',
    unlock: 2,
  },
  (info, host) => new MarketGame(info, host),
);
